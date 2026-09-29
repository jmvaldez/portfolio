import { expect, test } from '@playwright/test';
import { PAGE_URLS } from './page-urls';

// Analytics is off unless the build had `PUBLIC_POSTHOG_KEY`. This spec adapts to whichever
// build it is run against (the key is read from the same environment that built `dist/`):
// - keyless (local `pnpm verify`): nothing is emitted, nothing loads, nothing is requested.
// - keyed (CI, with a placeholder key): the beacon is there, and the shell's adapter and the
//   beacon POST only to same-origin `/ingest`, which `pnpm preview` doesn't serve (a 404 the
//   fire-and-forget senders ignore); no request leaves the machine and nothing throws.
const KEYED = Boolean(process.env['PUBLIC_POSTHOG_KEY']);

test.use({ viewport: { width: 1440, height: 900 } });

for (const { url } of PAGE_URLS) {
  test(`${url} ${KEYED ? 'carries one pageview beacon' : 'carries no beacon'}`, async ({
    request,
  }) => {
    const html = await (await request.get(url)).text();
    const beacons = html.match(/navigator\.sendBeacon/g) ?? [];
    if (KEYED) {
      expect(beacons).toHaveLength(1);
      expect(html).toContain("navigator.sendBeacon('/ingest/i/v0/e/'");
    } else {
      expect(beacons).toHaveLength(0);
      expect(html).not.toContain('/ingest');
    }
  });
}

test('/ never carries the beacon: the SDK owns its pageviews', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).not.toContain('navigator.sendBeacon');
});

test(`the desktop shell ${KEYED ? 'reaches only /ingest' : 'requests nothing analytics-related'}`, async ({
  page,
}) => {
  const requests: string[] = [];
  const posted: string[] = [];
  const errors: Error[] = [];
  page.on('request', (request) => {
    requests.push(request.url());
    if (request.method() === 'POST') posted.push(request.postData() ?? '');
  });
  page.on('pageerror', (error) => errors.push(error));

  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
  // The adapter starts on an idle callback that waits at most 4 s (the scene keeps the main
  // thread busy), so give it longer than that either way.
  if (KEYED) {
    await expect
      .poll(() => requests.some((url) => url.endsWith('/ingest/i/v0/e/')), { timeout: 10000 })
      .toBe(true);
  } else await page.waitForTimeout(5000);

  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
  const analytics = requests.filter((url) => /\/ingest\/|posthog/i.test(url));
  if (KEYED) {
    expect(analytics.length).toBeGreaterThan(0);
    // The shell sends its own pageview on start, cookieless.
    const pageview = posted.map((body) => JSON.parse(body) as Record<string, unknown>)[0];
    expect(pageview).toMatchObject({ event: '$pageview', distinct_id: '$posthog_cookieless' });
  } else expect(analytics).toEqual([]);
  expect(errors).toEqual([]);
});
