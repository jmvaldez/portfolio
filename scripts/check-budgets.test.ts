import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkContentPages } from './check-budgets.mjs';

const fixture = (name: string) => fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

describe('checkContentPages', () => {
  it('passes a clean page (ld+json is not counted as inline JS)', () => {
    const rows = checkContentPages(fixture('clean'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it('fails a page with an external script', () => {
    const failed = checkContentPages(fixture('external-script')).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual(['/about/ external/module scripts']);
  });

  it('fails a page with 1025 bytes of inline script', () => {
    const failed = checkContentPages(fixture('inline-1025')).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual(['/about/ inline JS']);
    expect(failed[0]?.actual).toBe(1025);
  });
});
