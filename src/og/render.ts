// Renders one OG card to a PNG: loads the fonts, checks glyph coverage, then runs Satori
// and resvg-js. The endpoint (`src/pages/og/[...path].png.ts`) calls only `renderOgImage`.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import * as fontkit from 'fontkit';
import { parseHexTokens, parseNumberToken } from '~/lib/tokens';
import { buildCard, type CardData, type CardTokens } from './card';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

// Read fonts against `process.cwd()`, not `import.meta.url`: at build time the latter
// resolves into `dist/.prerender/chunks/`. Kept out of `public/` since nothing at runtime
// needs the TTF and anything in `public/` ships.
const FONT_DIR = join(process.cwd(), 'src/assets/fonts/og');
export const REGULAR_TTF_PATH = join(FONT_DIR, 'valdez-mono-regular.ttf');
const BOLD_TTF_PATH = join(FONT_DIR, 'valdez-mono-bold.ttf');
const TOKENS_CSS_PATH = join(process.cwd(), 'src/styles/tokens.css');

interface LoadedFonts {
  regular: Buffer;
  bold: Buffer;
}

let fontsPromise: Promise<LoadedFonts> | undefined;

/** Both TTFs, loaded once and reused across every card in the build. */
function loadFonts(): Promise<LoadedFonts> {
  fontsPromise ??= Promise.all([readFile(REGULAR_TTF_PATH), readFile(BOLD_TTF_PATH)]).then(
    ([regular, bold]) => ({ regular, bold }),
  );
  return fontsPromise;
}

/** Parses the card palette out of `tokens.css`; scanline alpha is half the shell's. */
function loadTokens(tokensCss: string): CardTokens {
  const hex = parseHexTokens(tokensCss);
  const scanAlpha = parseNumberToken(tokensCss, 'scan-alpha');

  function token(name: string): string {
    const value = hex[name];
    if (!value) throw new Error(`og/render: token --${name} not found in tokens.css`);
    return value;
  }

  return {
    chrome: token('chrome'),
    chromeHi: token('chrome-hi'),
    ink: token('ink'),
    bodyInk: token('body-ink'),
    accent: token('accent'),
    edge: token('edge'),
    bgSunk: token('bg-sunk'),
    scanAlpha: scanAlpha / 2,
  };
}

/** Returns every distinct character the card renders. Satori silently drops a glyph
 * missing from the font, so every string that reaches it must be checked. */
function textOf(data: CardData): string[] {
  const strings = [data.path, data.title];
  for (const field of data.fields ?? []) strings.push(field.key, field.value);
  if (data.summary) strings.push(data.summary);
  return strings;
}

/** Throws, naming the missing character, rather than letting Satori drop it. `fontkit`
 * types a single-font file as `Font | FontCollection`; the guard keeps that assumption
 * from becoming a silent `undefined`. */
function assertGlyphsPresent(fontBuffer: Buffer, texts: string[]): void {
  const parsed = fontkit.create(fontBuffer);
  const font = 'hasGlyphForCodePoint' in parsed ? parsed : parsed.fonts[0];
  if (!font) throw new Error('og/render: font file has no usable font (empty collection)');

  const seen = new Set<string>();
  for (const text of texts) {
    for (const char of text) {
      if (seen.has(char)) continue;
      seen.add(char);
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) continue;
      if (!font.hasGlyphForCodePoint(codePoint)) {
        const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
        throw new Error(`og/render: font has no glyph for "${char}" (U+${hex})`);
      }
    }
  }
}

/** Renders one card to a 1200×630 PNG. */
export async function renderOgImage(data: CardData): Promise<Buffer> {
  const [{ regular, bold }, tokensCss] = await Promise.all([
    loadFonts(),
    readFile(TOKENS_CSS_PATH, 'utf-8'),
  ]);

  assertGlyphsPresent(regular, textOf(data));

  const tokens = loadTokens(tokensCss);
  const card = buildCard(data, tokens);

  const svg = await satori(card as unknown as ReactNode, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: 'Valdez Mono', data: regular, weight: 400, style: 'normal' },
      { name: 'Valdez Mono', data: bold, weight: 700, style: 'normal' },
    ],
  });

  // resvg-js scans system fonts by default (~70-80 ms per image); Satori has already
  // turned every glyph into a path, so resvg needs none.
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}
