import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createFacade } from './index';
import { noopAnalytics } from './noop';
import { loadAdapter, loadBeacon } from './provider';
import { posthogBeacon } from './adapters/posthog';
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

describe('posthogBeacon', () => {
  const key = 'phc_' + 'x'.repeat(43);
  const script = posthogBeacon(key);

  it('posts a cookieless pageview through the proxy to the capture endpoint', () => {
    expect(script).toContain("navigator.sendBeacon('/ingest/i/v0/e/'");
    expect(script).toContain(`api_key:'${key}'`);
    expect(script).toContain("event:'$pageview'");
    expect(script).toContain("distinct_id:'$posthog_cookieless'");
    expect(script).toContain('$cookieless_mode:!0');
  });

  it('carries the URL, path, referrer, user agent, sizes and UTM params', () => {
    for (const name of [
      '$current_url',
      '$host',
      '$pathname',
      '$referrer',
      '$raw_user_agent',
      '$screen_width',
      '$screen_height',
      '$viewport_width',
      '$viewport_height',
      'utm_',
    ]) {
      expect(script).toContain(name);
    }
  });

  it('runs: sends the payload the capture endpoint expects', () => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
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
        sendBeacon: (url: string, body: string) =>
          void sent.push({ url, body: JSON.parse(body) as Record<string, unknown> }),
      },
      innerWidth: 800,
      innerHeight: 600,
      URLSearchParams,
    };
    runInNewContext(script, globals);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('/ingest/i/v0/e/');
    expect(sent[0]?.body).toEqual({
      api_key: key,
      event: '$pageview',
      distinct_id: '$posthog_cookieless',
      properties: {
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
      },
    });
  });

  it('rejects a key that could break out of the script', () => {
    expect(() => posthogBeacon("x'});alert(1);//")).toThrow();
  });

  it('is at most 600 bytes, so the CRT script and beacon share the content-page budget', () => {
    expect(Buffer.byteLength(script, 'utf8')).toBeLessThanOrEqual(600);
  });
});
