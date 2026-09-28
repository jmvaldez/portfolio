// Contrast and treatment tests. A palette that passes AA unattenuated can still fail
// under its own scanline, so contrast is checked both clean and darkened. `tokens.css` is
// read as text because Node can't evaluate CSS custom properties.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseHexTokens, parseNumberToken } from '~/lib/tokens';

const stylesDir = fileURLToPath(new URL('.', import.meta.url));
const tokensSource = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8');

const tokens = parseHexTokens(tokensSource);
const scanAlpha = parseNumberToken(tokensSource, 'scan-alpha');

/** Returns the parsed hex token `name`; throws if it is missing from tokens.css. */
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

/** Alpha-composites opaque black at `alpha` over a hex colour, simulating the peak of
 * the CRT scanline band (which tops out at `--scan-alpha`). */
function darkenWithBlack(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const blend = (channel: number) => Math.round(channel * (1 - alpha));
  const toHexByte = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHexByte(blend(r))}${toHexByte(blend(g))}${toHexByte(blend(b))}`;
}

describe('token contrast', () => {
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

  it('--ink on --bg reaches the ~10.2:1 target unattenuated', () => {
    expect(contrastRatio(token('ink'), token('bg'))).toBeGreaterThanOrEqual(10.2);
  });

  it('--scan-alpha stays under the 0.35 ceiling', () => {
    expect(scanAlpha).toBeLessThanOrEqual(0.35);
  });

  it('--body-ink on --body-bg reaches AAA (7:1) since .prose never carries .scan', () => {
    expect(contrastRatio(token('body-ink'), token('body-bg'))).toBeGreaterThanOrEqual(7);
  });
});

describe('CRT treatment avoids filter, blend modes, backdrop-filter and animation', () => {
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
