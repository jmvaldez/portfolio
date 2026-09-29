import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFacade } from './index';
import { noopAnalytics } from './noop';
import { loadAdapter, loadBeacon } from './provider';
import { createPosthog, posthogBeacon } from './adapters/posthog';
import type { Analytics } from './types';

function fakeAdapter(): Analytics & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    init: () => {
      calls.push(['init']);
      return Promise.resolve();
    },
    track: (event, props) => void calls.push(['track', event, props]),
    page: () => void calls.push(['page']),
  };
}

describe('facade', () => {
  it('queues calls until the adapter is ready, then replays them in order', async () => {
    const adapter = fakeAdapter();
    const facade = createFacade(() => Promise.resolve(adapter));

    facade.track('window_promoted', { path: '/about.txt' });
    facade.page();
    expect(adapter.calls).toEqual([]);

    await facade.init();
    expect(adapter.calls).toEqual([
      ['init'],
      ['track', 'window_promoted', { path: '/about.txt' }],
      ['page'],
    ]);

    facade.track('terminal_command_run', { command: 'ls' });
    expect(adapter.calls.at(-1)).toEqual(['track', 'terminal_command_run', { command: 'ls' }]);
  });

  it('starts the adapter only once', async () => {
    const load = vi.fn(() => Promise.resolve(fakeAdapter()));
    const facade = createFacade(load);
    await Promise.all([facade.init(), facade.init()]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('is a no-op with the noop adapter', async () => {
    const facade = createFacade(() => Promise.resolve(noopAnalytics));
    facade.track('shell_entered', { mode: 'boot' });
    await expect(facade.init()).resolves.toBeUndefined();
    expect(() => facade.page()).not.toThrow();
  });

  it('survives an adapter that fails to load, dropping its queue', async () => {
    const facade = createFacade(() => Promise.reject(new Error('blocked')));
    facade.track('shell_entered', { mode: 'boot' });
    await expect(facade.init()).resolves.toBeUndefined();
    expect(() => facade.track('shell_entered', { mode: 'restore' })).not.toThrow();
  });
});

describe('adapter selection', () => {
  it('picks the noop adapter and no beacon without a key', async () => {
    for (const key of [undefined, '']) {
      expect(await loadAdapter(key)).toBe(noopAnalytics);
      expect(await loadBeacon(key)).toBeNull();
    }
  });

  it('picks a real adapter and a beacon with a key', async () => {
    const key = 'phc_test_key_0000000000000000000000000000000';
    expect(await loadAdapter(key)).not.toBe(noopAnalytics);
    expect(await loadBeacon(key)).toBe(posthogBeacon(key));
  });
});

const KEY = 'phc_' + 'x'.repeat(43);

interface Sent {
  url: string;
  body: Record<string, unknown>;
}

/** A fake browser for the beacon script and the adapter alike, so the two can be held to
 * one payload. `sendBeacon` records what it is given and returns `beaconOk`. */
function fakeBrowser(beaconOk = true) {
  const sent: Sent[] = [];
  const fetched: (Sent & { init: RequestInit })[] = [];
  const record = (url: string, body: string): Sent => ({
    url,
    body: JSON.parse(body) as Record<string, unknown>,
  });
  const globals = {
    location: {
      href: 'https://example.com/about/?utm_source=x&other=1',
      host: 'example.com',
      pathname: '/about/',
      search: '?utm_source=x&other=1',
    },
    screen: { width: 1920, height: 1080 },
    document: { referrer: 'https://ref.example/' },
    navigator: {
      userAgent: 'UA',
      sendBeacon: (url: string, body: string) => {
        sent.push(record(url, body));
        return beaconOk;
      },
    },
    innerWidth: 800,
    innerHeight: 600,
    URLSearchParams,
    fetch: (url: string, init: RequestInit) => {
      fetched.push({ ...record(url, init.body as string), init });
      return Promise.resolve(new Response());
    },
  };
  return { globals, sent, fetched };
}

const PAGEVIEW_PROPERTIES = {
  $cookieless_mode: true,
  $process_person_profile: false,
  $current_url: 'https://example.com/about/?utm_source=x&other=1',
  $host: 'example.com',
  $pathname: '/about/',
  $referrer: 'https://ref.example/',
  $raw_user_agent: 'UA',
  $screen_width: 1920,
  $screen_height: 1080,
  $viewport_width: 800,
  $viewport_height: 600,
  utm_source: 'x',
};

describe('posthogBeacon', () => {
  const script = posthogBeacon(KEY);

  it('posts a cookieless pageview through the proxy to the capture endpoint', () => {
    expect(script).toContain("navigator.sendBeacon('/ingest/i/v0/e/'");
    expect(script).toContain(`api_key:'${KEY}'`);
    expect(script).toContain("event:'$pageview'");
    expect(script).toContain("distinct_id:'$posthog_cookieless'");
    expect(script).toContain('$cookieless_mode:!0');
  });

  it('sends the payload the capture endpoint expects', () => {
    const { globals, sent } = fakeBrowser();
    runInNewContext(script, globals);

    expect(sent).toEqual([
      {
        url: '/ingest/i/v0/e/',
        body: {
          api_key: KEY,
          event: '$pageview',
          distinct_id: '$posthog_cookieless',
          properties: PAGEVIEW_PROPERTIES,
        },
      },
    ]);
  });

  it('rejects a key that could break out of the script', () => {
    expect(() => posthogBeacon("x'});alert(1);//")).toThrow();
  });

  it('is at most 600 bytes, so the CRT script and beacon share the content-page budget', () => {
    expect(Buffer.byteLength(script, 'utf8')).toBeLessThanOrEqual(600);
  });
});

describe('createPosthog', () => {
  afterEach(() => vi.unstubAllGlobals());

  function install(beaconOk = true) {
    const browser = fakeBrowser(beaconOk);
    for (const [name, value] of Object.entries(browser.globals)) vi.stubGlobal(name, value);
    return browser;
  }

  it('sends the same pageview as the content-page beacon, on init', async () => {
    const { globals, sent } = install();
    await createPosthog(KEY).init();
    const runtime = sent.splice(0);
    expect(runtime).toHaveLength(1);

    runInNewContext(posthogBeacon(KEY), globals);
    expect(runtime).toEqual(sent);
  });

  it('sends catalogue events with their props, cookieless and without UTM params', async () => {
    const { sent } = install();
    const adapter = createPosthog(KEY);
    await adapter.init();
    adapter.track('terminal_command_run', { command: 'ls' });
    const withoutUtm: Record<string, unknown> = { ...PAGEVIEW_PROPERTIES };
    delete withoutUtm['utm_source'];

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      url: '/ingest/i/v0/e/',
      body: {
        api_key: KEY,
        event: 'terminal_command_run',
        distinct_id: '$posthog_cookieless',
        properties: { ...withoutUtm, command: 'ls' },
      },
    });
  });

  it('page() sends another pageview', () => {
    const { sent } = install();
    const adapter = createPosthog(KEY);
    adapter.page();
    expect(sent.map((s) => s.body.event)).toEqual(['$pageview']);
  });

  it('falls back to a keepalive fetch when sendBeacon returns false', () => {
    const { sent, fetched } = install(false);
    createPosthog(KEY).track('window_promoted', { path: '/about.txt' });

    expect(sent).toHaveLength(1);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]?.url).toBe('/ingest/i/v0/e/');
    expect(fetched[0]?.init).toMatchObject({ method: 'POST', keepalive: true });
    expect(fetched[0]?.body).toEqual(sent[0]?.body);
  });

  it('falls back to fetch when sendBeacon throws, and never throws itself', () => {
    const { globals } = install();
    vi.stubGlobal('navigator', {
      ...globals.navigator,
      sendBeacon: () => {
        throw new Error('nope');
      },
    });
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    expect(() => createPosthog(KEY).track('shell_entered', { mode: 'boot' })).not.toThrow();
  });
});
