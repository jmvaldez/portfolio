import { expect, test } from '@playwright/test';
import { PAGE_URLS } from './page-urls';

// Ticket 19's cheapest guard: content pages ship zero external/module scripts and
// <= 1 KB of inline JS. Lands now, before any client-side island exists, so a later
// phase can't quietly regress it.
//
// `/` joins the list here now that it's the real linear layout (Phase 6) rather than
// Phase 3's placeholder Frame, and it is genuinely zero-JS today. Phase 8 moves `/` to
// its own separate budget once the shell island's opt-in `client:only` behaviour lands
// there, since the island (not this document) will carry non-zero JS above the
// breakpoint.
const URLS = [{ url: '/' }, ...PAGE_URLS];

for (const { url } of URLS) {
  test(`${url} ships no external/module scripts and <= 1024 bytes of inline JS`, async ({
    request,
  }) => {
    const response = await request.get(url);
    const html = await response.text();

    expect(html).not.toContain('<script src');
    expect(html).not.toContain('type="module"');

    let inlineBytes = 0;
    // Excludes `type="application/ld+json"` (Phase 7's Person schema on `/`): it's data
    // rendered with `set:html`, never executable JS, so it doesn't belong in this budget.
    const scriptRe = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
    for (const match of html.matchAll(scriptRe)) {
      const attrs = match[1] ?? '';
      if (/\btype="application\/ld\+json"/.test(attrs)) continue;
      inlineBytes += Buffer.byteLength(match[2] ?? '', 'utf8');
    }

    expect(inlineBytes).toBeLessThanOrEqual(1024);
  });
}
