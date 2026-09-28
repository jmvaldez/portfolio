// Self-canonical plus a working `og:image` on every URL, and the sitemap and robots
// that sit on top of them.
import { expect, test } from '@playwright/test';
import { PAGE_URLS } from './page-urls';

// `/` joins PAGE_URLS here (same as `zero-js.spec.ts`): it carries meta too, it just has
// no collection entry behind it (`lib/meta.ts`'s root special case).
const URLS = [{ url: '/' }, ...PAGE_URLS];

for (const { url } of URLS) {
  test(`${url} is self-canonical`, async ({ page }) => {
    await page.goto(url);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).not.toBeNull();
    expect(new URL(canonical!).pathname).toBe(url);
  });

  test(`${url} og:image resolves to a 200 image/png`, async ({ page }) => {
    await page.goto(url);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).not.toBeNull();

    // `og:image` is absolute against `site` (a placeholder domain that doesn't resolve
    // here); the path is what matters, served by the same preview.
    const response = await page.request.get(new URL(ogImage!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
  });
}

test('/sitemap-index.xml lists every page and nothing under /og/, /fs/ or /resume.pdf', async ({
  page,
}) => {
  const indexResponse = await page.request.get('/sitemap-index.xml');
  expect(indexResponse.status()).toBe(200);
  const indexBody = await indexResponse.text();

  const [sitemapUrl] = [...indexBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  expect(sitemapUrl).toBeDefined();

  const sitemapResponse = await page.request.get(new URL(sitemapUrl!).pathname);
  expect(sitemapResponse.status()).toBe(200);
  const sitemapBody = await sitemapResponse.text();

  const locs = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]!).pathname,
  );

  expect(new Set(locs)).toEqual(new Set(URLS.map(({ url }) => url)));
  for (const loc of locs) {
    expect(loc).not.toContain('/og/');
    expect(loc).not.toContain('/fs/');
    expect(loc).not.toBe('/resume.pdf');
  }
});

test('/robots.txt names the sitemap', async ({ page }) => {
  const response = await page.request.get('/robots.txt');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toMatch(/^Sitemap:\s*https?:\/\/\S+$/m);
});
