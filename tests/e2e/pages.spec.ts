import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { PAGE_URLS } from './page-urls';

// Re-exported so this stays the file any suite reaches for `PAGE_URLS`; the list itself
// lives in `page-urls.ts` because Playwright refuses to let one spec file import
// another, and `zero-js.spec.ts` needs it too. "dist matches PAGE_URLS" below, and any
// later suite, can't silently miss a new seed page this way.
export { PAGE_URLS };

// Breadcrumb accessible names, spot-checked: the visible text is the URL segment, the
// accessible name is the target node's title.
const BREADCRUMB_TITLES: Record<string, { segment: string; title: string }[]> = {
  '/projects/orbital-mesh/notes/': [
    { segment: 'projects', title: 'Projects' },
    { segment: 'orbital-mesh', title: 'Orbital Mesh' },
  ],
  '/drones/nazgul/tuning/': [
    { segment: 'drones', title: 'Drones' },
    { segment: 'nazgul', title: 'Nazgul' },
  ],
};

for (const { url, filename } of PAGE_URLS) {
  test(`${url} returns 200, has the right masthead and close box`, async ({ page }) => {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(filename);

    const closeBox = page.locator('a.closebox');
    await expect(closeBox).toHaveAttribute('href', '/');
    await expect(closeBox).toHaveAccessibleName('Return to home');
  });
}

for (const [url, crumbs] of Object.entries(BREADCRUMB_TITLES)) {
  test(`${url} breadcrumb links are named after each segment's title`, async ({ page }) => {
    await page.goto(url);
    for (const { segment, title } of crumbs) {
      const link = page.locator('nav[aria-label="Breadcrumb"] a', { hasText: segment });
      await expect(link).toHaveAccessibleName(title);
    }
  });
}

test('the built dist directories match PAGE_URLS exactly', () => {
  const distDir = join(process.cwd(), 'dist');
  const found = new Set<string>();

  function walk(dir: string, urlPrefix: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      const nextPrefix = `${urlPrefix}${entry}/`;
      const indexPath = join(full, 'index.html');
      try {
        if (statSync(indexPath).isFile()) found.add(nextPrefix);
      } catch {
        // no index.html directly in this directory; still recurse into it
      }
      walk(full, nextPrefix);
    }
  }

  walk(distDir, '/');
  // dist/index.html itself (the "/" route) is explicitly excluded.
  found.delete('/');

  const expected = new Set(PAGE_URLS.map(({ url }) => url));
  expect(found).toEqual(expected);
});

// Spec block field presence/omission, no iframes, and the prose/.scan split.

test('the nazgul drone page shows a HARDWARE label', async ({ page }) => {
  await page.goto('/drones/nazgul/');
  await expect(page.getByText('Hardware', { exact: true })).toBeVisible();
});

test('the pico-whoop page omits WEIGHT since the field is unset', async ({ page }) => {
  await page.goto('/drones/pico-whoop/');
  await expect(page.getByText('Weight', { exact: true })).toHaveCount(0);
});

test('no page anywhere embeds an iframe', async ({ page }) => {
  for (const { url } of PAGE_URLS) {
    await page.goto(url);
    expect(await page.locator('iframe').count()).toBe(0);
  }
});

test('.prose has no ancestor carrying .scan', async ({ page }) => {
  await page.goto('/projects/orbital-mesh/');
  const scanAncestors = await page.locator('.prose').evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement;
    let count = 0;
    while (node) {
      if (node.classList?.contains('scan')) count++;
      node = node.parentElement;
    }
    return count;
  });
  expect(scanAncestors).toBe(0);
});

// Order in the folder listing, a directory's readme + children together, and prev/next
// between siblings.

test('/projects/ lists the three projects in curated order', async ({ page }) => {
  await page.goto('/projects/');
  const names = await page.locator('.folder-listing-rows .folder-col-name').allTextContents();
  expect(names).toEqual(['orbital-mesh/', 'signal-relay/', 'ledger-lite.md']);
});

test('/projects/orbital-mesh/ shows its own body and lists its child notes.md', async ({
  page,
}) => {
  await page.goto('/projects/orbital-mesh/');
  await expect(page.locator('.prose')).toContainText('Overview');
  await expect(page.locator('.folder-listing-rows')).toContainText('notes.md');
});

test('prev/next on /projects/ledger-lite/ points at its curated-order neighbour', async ({
  page,
}) => {
  await page.goto('/projects/ledger-lite/');
  const nav = page.locator('nav[aria-label="Sibling pages"]');
  // The order is orbital-mesh, signal-relay, ledger-lite: ledger-lite is last, so it has
  // a prev (signal-relay) and no next.
  await expect(nav.locator('.prevnext-prev')).toHaveText('← Signal Relay');
  await expect(nav.locator('.prevnext-next')).toHaveCount(0);
});
