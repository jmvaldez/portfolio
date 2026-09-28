import { expect, test } from '@playwright/test';
import { PAGE_URLS } from './page-urls';

// Ticket 19's cheapest guard: content pages ship zero external/module scripts and
// <= 1 KB of inline JS. Lands now, before any client-side island exists, so a later
// phase can't quietly regress it.
//
// `/` is exempt from this strict budget as of Phase 8: it legitimately carries a
// `client:only` React island plus the head-gate/boot inline scripts, and gets its
// own, more generous budget check in Phase 13. Content pages stay at zero.
const URLS = [...PAGE_URLS];

for (const { url } of URLS) {
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
