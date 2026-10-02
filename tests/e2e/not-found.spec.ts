// An unknown path answers with a real 404 and the 404 page (Cloudflare Pages does the
// same with `dist/404.html`), rather than the home page with a 200. The page is a static
// content page: no desktop shell, not indexed, not in the sitemap.
import { expect, test } from '@playwright/test';

test('an unknown path returns 404 with the 404 page', async ({ page }) => {
  const response = await page.goto('/definitely-not-a-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page wandered off');
  await expect(page.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute(
    'href',
    '/',
  );
});

test('the 404 page is noindex, has no canonical and boots no shell', async ({ page }) => {
  await page.goto('/404/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('astro-island')).toHaveCount(0);
});

test('/404/ is not in the sitemap', async ({ page }) => {
  const index = await (await page.request.get('/sitemap-index.xml')).text();
  const [sitemapUrl] = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  const body = await (await page.request.get(new URL(sitemapUrl!).pathname)).text();
  expect(body).not.toContain('/404/');
});

test('the 404 page ships no external/module scripts and <= 1536 bytes of inline JS', async ({
  request,
}) => {
  const html = await (await request.get('/404/')).text();
  expect(html).not.toContain('<script src');
  expect(html).not.toContain('type="module"');
  let inlineBytes = 0;
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    inlineBytes += Buffer.byteLength(match[2] ?? '', 'utf8');
  }
  expect(inlineBytes).toBeLessThanOrEqual(1536);
});
