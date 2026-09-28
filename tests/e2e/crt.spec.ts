import { expect, test } from '@playwright/test';

// The CRT preference (`vos:crt` in localStorage) is set by CrtPrefScript before first
// paint. These specs exercise the three inputs that script reads, in priority order: a
// stored preference beats the media queries, and `forced-colors`/`prefers-contrast`
// only supply a default.

test('data-crt defaults to "on" with no stored preference and no forced media', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'on');
});

test('the CRT toggle sets data-crt to "off" and it survives a reload', async ({ page }) => {
  // Above the breakpoint with JS on, the shell hides `/`'s taskbar strip (`html.shell`).
  // The layout override keeps the linear layout, and its toggle, visible: the toggle is
  // under test, not the shell handover.
  await page.addInitScript(() => localStorage.setItem('vos:layout-override', 'linear'));
  await page.goto('/');
  await page.locator('[data-crt-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
});

test('forced-colors with no stored preference defaults data-crt to "off"', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
  await context.close();
});

test('prefers-contrast: more defaults data-crt off, but the toggle still works', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Keep the linear layout and its toggle visible above the breakpoint (see the reload
  // test above).
  await page.addInitScript(() => localStorage.setItem('vos:layout-override', 'linear'));
  await page.emulateMedia({ contrast: 'more' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');

  await page.locator('[data-crt-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'on');
  await context.close();
});
