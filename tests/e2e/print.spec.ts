import { expect, test } from '@playwright/test';

// The print stylesheet: loaded on every page, tuned for `/resume/`.
// `page.emulateMedia({ media: 'print' })` is Playwright's recipe for exercising
// `@media print` / a `print`-qualified `@import` without a print dialog.

test('printing /resume/ hides the taskbar strip and breadcrumbs', async ({ page }) => {
  await page.goto('/resume/');
  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('.taskbar-strip')).toBeHidden();
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeHidden();
});

test('printing /resume/ sets black text on white', async ({ page }) => {
  await page.goto('/resume/');
  await page.emulateMedia({ media: 'print' });

  const color = await page.locator('body').evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe('rgb(0, 0, 0)');
});

test('printing /resume/ hides the DOWNLOAD PDF link', async ({ page }) => {
  await page.goto('/resume/');
  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('a[download]')).toBeHidden();
});

// The mailto link the print rule targets lives on /contact/ (the resume seed content
// carries no address of its own). The rule is sitewide, so exercising it there is
// equivalent to exercising it on /resume/.
test("printing /contact/ prints a mailto link's address after its text", async ({ page }) => {
  await page.goto('/contact/');
  await page.emulateMedia({ media: 'print' });

  const link = page.locator('a[href^="mailto:"]').first();
  const href = await link.getAttribute('href');
  const afterContent = await link.evaluate((el) => getComputedStyle(el, '::after').content);
  expect(href).toBeTruthy();
  expect(afterContent).toContain(href!.replace('mailto:', ''));
});
