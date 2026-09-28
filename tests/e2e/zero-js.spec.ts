import { expect, test } from '@playwright/test';
import { PAGE_URLS } from './page-urls';

// Ticket 19's cheapest guard: content pages ship zero external/module scripts and
// <= 1 KB of inline JS. Lands now, before any client-side island exists, so a later
// phase can't quietly regress it.

for (const { url } of PAGE_URLS) {
  test(`${url} ships no external/module scripts and <= 1024 bytes of inline JS`, async ({
    request,
  }) => {
    const response = await request.get(url);
    const html = await response.text();

    expect(html).not.toContain('<script src');
    expect(html).not.toContain('type="module"');

    let inlineBytes = 0;
    const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    for (const match of html.matchAll(scriptRe)) {
      inlineBytes += Buffer.byteLength(match[1] ?? '', 'utf8');
    }

    expect(inlineBytes).toBeLessThanOrEqual(1024);
  });
}
