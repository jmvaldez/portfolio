import { expect, test } from '@playwright/test';

// Task 5.2: the PDF `pnpm build` renders alongside the site, and the page's link to it
// (ticket 15 § Shell and page behaviour).

test('/resume.pdf is served as a PDF', async ({ request }) => {
  const response = await request.get('/resume.pdf');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
});

test('the DOWNLOAD PDF link on /resume/ names the saved file', async ({ page }) => {
  await page.goto('/resume/');
  const link = page.locator('a[href="/resume.pdf"]');
  await expect(link).toHaveAttribute('download', 'joe-valdez-resume.pdf');
});
