// Contrast and treatment tests (Task 3.5; ticket 06 § Two corrections; ticket 02 §
// scanline alpha ceiling; map Hazards: "a palette that passes AA unattenuated can
// still fail under its own scanline"). Reads `tokens.css` as text rather than
// importing it — CSS custom properties are not values Node can evaluate, so the
// tokens under test have to be scraped out of the same file the browser reads.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDir = fileURLToPath(new URL('.', import.meta.url));
const tokensSource = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8');

/** Every `--token-name: #rrggbb;` declaration in `tokens.css`, keyed without the `--`. */
function parseHexTokens(source: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of source.matchAll(/--([\w-]+):\s*#([0-9a-fA-F]{6});/g)) {
    const [, name, hex] = match;
    if (name && hex) tokens[name] = `#${hex}`;
  }
  return tokens;
}

/** The bare numeric value of a `--token-name: <number>;` declaration (e.g. `--scan-alpha`). */
function parseNumberToken(source: string, name: string): number {
  const match = source.match(new RegExp(`--${name}:\\s*([\\d.]+);`));
  if (!match) throw new Error(`token --${name} not found in tokens.css`);
  return Number(match[1]);
}

const tokens = parseHexTokens(tokensSource);
const scanAlpha = parseNumberToken(tokensSource, 'scan-alpha');

/** Looks up a parsed hex token, throwing (rather than returning `undefined`) if it's
 * missing — keeps the strict `noUncheckedIndexedAccess` compiler happy while still
 * failing loudly if a token name is misspelled or removed from tokens.css. */
function token(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`token --${name} not found in tokens.css`);
  return value;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** WCAG relative luminance (sRGB gamma-corrected). */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [linearize(r), linearize(g), linearize(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG contrast ratio between two hex colours (always ≥ 1). */
function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha-composites opaque black at `alpha` over a hex colour — simulates the peak of
 * the CRT scanline band (ticket 06's soft-edged gradient tops out at `--scan-alpha`). */
function darkenWithBlack(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const blend = (channel: number) => Math.round(channel * (1 - alpha));
  const toHexByte = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHexByte(blend(r))}${toHexByte(blend(g))}${toHexByte(blend(b))}`;
}

describe('token contrast (ticket 06 § Two corrections, ticket 02 § contrast holds)', () => {
  const inkTokens = ['ink', 'ink-dim', 'ink-faint', 'accent'];
  const surfaces = ['bg', 'chrome'];

  for (const inkName of inkTokens) {
    for (const surfaceName of surfaces) {
      it(`--${inkName} on --${surfaceName} is >= 4.5:1, clean and under a scanline`, () => {
        const ink = token(inkName);
        const surface = token(surfaceName);

        const clean = contrastRatio(ink, surface);
        expect(clean).toBeGreaterThanOrEqual(4.5);

        const darkenedSurface = darkenWithBlack(surface, scanAlpha);
        const underScanline = contrastRatio(ink, darkenedSurface);
        expect(underScanline).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("--ink on --bg reaches ticket 06's ~10.2:1 target unattenuated", () => {
    expect(contrastRatio(token('ink'), token('bg'))).toBeGreaterThanOrEqual(10.2);
  });

  it("--scan-alpha stays under ticket 02's 0.35 ceiling", () => {
    expect(scanAlpha).toBeLessThanOrEqual(0.35);
  });

  it('--body-ink on --body-bg reaches AAA (7:1) since .prose never carries .scan', () => {
    expect(contrastRatio(token('body-ink'), token('body-bg'))).toBeGreaterThanOrEqual(7);
  });
});

describe('CRT treatment refusals (map Hazards: filter/blend/backdrop-filter/animation bans)', () => {
  const forbidden = [
    'mix-blend-mode',
    'backdrop-filter',
    'filter:',
    'font-variant-caps',
    '@keyframes',
  ];

  const cssFiles = readdirSync(stylesDir).filter((name) => name.endsWith('.css'));

  for (const fileName of cssFiles) {
    for (const needle of forbidden) {
      it(`${fileName} does not contain "${needle}"`, () => {
        const source = readFileSync(new URL(fileName, import.meta.url), 'utf-8');
        expect(source).not.toContain(needle);
      });
    }
  }
});
