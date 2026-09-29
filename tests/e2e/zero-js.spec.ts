import { expect, test } from '@playwright/test';
import { PAGE_URLS } from './page-urls';

// Content pages ship zero external/module scripts and <= 1.5 KB of inline JS.
//
// `/` is exempt from this strict budget: it carries a `client:only` React island plus
// the head-gate/boot inline scripts, and has its own, more generous budget check
// (`scripts/check-budgets.mjs`).
const URLS = [...PAGE_URLS];

for (const { url } of URLS) {
  test(`${url} ships no external/module scripts and <= 1536 bytes of inline JS`, async ({
    request,
  }) => {
    const response = await request.get(url);
    const html = await response.text();

    expect(html).not.toContain('<script src');
    expect(html).not.toContain('type="module"');

    let inlineBytes = 0;
    // Excludes `type="application/ld+json"` (the Person schema on `/`): it's data rendered
    // with `set:html`, never executable JS, so it doesn't belong in this budget.
    const scriptRe = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
    for (const match of html.matchAll(scriptRe)) {
      const attrs = match[1] ?? '';
      if (/\btype="application\/ld\+json"/.test(attrs)) continue;
      inlineBytes += Buffer.byteLength(match[2] ?? '', 'utf8');
    }

    expect(inlineBytes).toBeLessThanOrEqual(1536);
  });
}
