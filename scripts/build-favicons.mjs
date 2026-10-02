#!/usr/bin/env node
/**
 * Rasterizes `public/favicon.svg` into `public/apple-touch-icon.png` and
 * `public/favicon.ico`. Run with `pnpm favicons` after editing the SVG.
 *
 * NOT run in CI: the outputs are committed, like the fonts from `subset-fonts.py`.
 * Uses `@resvg/resvg-js`, which already renders the OG cards, so no new dependency.
 *
 * - The ICO holds 16x16 and 32x32 PNG frames. ICO has stored PNG data directly since
 *   Vista, so no BMP encoder is needed.
 * - The apple-touch-icon is full-bleed: iOS rounds the corners itself, and would fill
 *   our transparent corners with black.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const PUBLIC = new URL('../public/', import.meta.url);
const ICO_SIZES = [16, 32];
const TOUCH_SIZE = 180;

const svg = await readFile(new URL('favicon.svg', PUBLIC), 'utf-8');
// The master's tile is rounded; drop `rx` for the touch icon.
const fullBleed = svg.replace(' rx="12"', '');
if (fullBleed === svg) throw new Error('build-favicons: no rx="12" found in favicon.svg');

const render = (source, size) =>
  new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();

/** ICONDIR + one ICONDIRENTRY per frame, then the PNG payloads back to back. */
function buildIco(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry); // width
    header.writeUInt8(size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map((f) => f.png)]);
}

const frames = ICO_SIZES.map((size) => ({ size, png: render(svg, size) }));
await writeFile(new URL('favicon.ico', PUBLIC), buildIco(frames));
await writeFile(new URL('apple-touch-icon.png', PUBLIC), render(fullBleed, TOUCH_SIZE));
console.log('wrote public/favicon.ico and public/apple-touch-icon.png');
