#!/usr/bin/env node
/**
 * Byte-budget check over `dist/`. Run after `pnpm build`; checks each budget, prints a
 * table and exits non-zero on any failure.
 *
 * Units: file weights (JS, CSS, fonts, SVG, PDF) are gzip bytes, `1 KB = 1024`. Inline
 * script budgets are raw UTF-8 bytes, matching `tests/e2e/zero-js.spec.ts`, its e2e twin.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const KB = 1024;

export const BUDGETS = {
  contentExternalJs: 0,
  contentInlineJs: 1.5 * KB,
  headGate: 1.5 * KB,
  islandInitial: 90 * KB,
  sceneChunk: 250 * KB,
  css: 20 * KB,
  fonts: 60 * KB,
  fontPreloads: 1,
  droneSvg: 15 * KB,
  resumePdf: 150 * KB,
};

const gzipBytes = (buffer) => gzipSync(buffer).length;
const byteLength = (text) => Buffer.byteLength(text, 'utf8');

/** Every `index.html` under `dist`, plus the root `404.html`, as `{ url, file }`, `/` first. */
function listPages(dist) {
  const pages = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === 'index.html') {
        const rel = relative(dist, dir).split('\\').join('/');
        pages.push({ url: rel === '' ? '/' : `/${rel}/`, file: path });
      } else if (dir === dist && entry.name === '404.html') {
        pages.push({ url: '/404.html', file: path });
      }
    }
  };
  walk(dist);
  return pages.sort((a, b) => a.url.length - b.url.length || a.url.localeCompare(b.url));
}

/** Inline `<script>` bodies (no `src`), excluding `application/ld+json`. */
function inlineScripts(html) {
  const scripts = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/ld\+json"/.test(match[1] ?? '')) continue;
    scripts.push(match[2] ?? '');
  }
  return scripts;
}

const row = (name, budget, actual, unit, ok = actual <= budget) => ({
  name,
  budget,
  actual,
  unit,
  ok,
});

/**
 * Content pages (every `index.html` but the root, and `404.html`): no `<script src`, no module script,
 * inline JS <= 1.5 KB (the CRT script plus the analytics beacon). Kept apart from
 * `checkBudgets` so a fixture `dist/` needs no shell.
 */
export function checkContentPages(dist) {
  const rows = [];
  for (const { url, file } of listPages(dist)) {
    if (url === '/') continue;
    const html = readFileSync(file, 'utf8');
    const external = (html.match(/<script\s+src|<script[^>]*\ssrc=|type="module"/g) ?? []).length;
    const inline = inlineScripts(html).reduce((sum, body) => sum + byteLength(body), 0);
    rows.push(row(`${url} external/module scripts`, BUDGETS.contentExternalJs, external, 'count'));
    rows.push(row(`${url} inline JS`, BUDGETS.contentInlineJs, inline, 'B'));
  }
  return rows;
}

/** CSS <= 20 KB and exactly one font preload, per page. */
export function checkPageAssets(dist) {
  const rows = [];
  for (const { url, file } of listPages(dist)) {
    const html = readFileSync(file, 'utf8');
    let css = 0;
    for (const match of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
      css += gzipBytes(readFileSync(join(dist, match[1] ?? '')));
    }
    for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      css += gzipBytes(Buffer.from(match[1] ?? ''));
    }
    const preloads = (html.match(/<link[^>]*rel="preload"[^>]*as="font"/g) ?? []).length;
    rows.push(row(`${url} CSS`, BUDGETS.css, css, 'B'));
    rows.push(row(`${url} font preloads`, BUDGETS.fontPreloads, preloads, 'count', preloads === 1));
  }
  return rows;
}

/**
 * Gzip size of `entries` plus everything they statically import, each file counted once
 * (across entries too, so shared modules such as react are not double-counted).
 */
function graphBytes(assetDir, entries) {
  const seen = new Set();
  let total = 0;
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const source = readFileSync(join(assetDir, name));
    total += gzipBytes(source);
    // Static imports only: `import ... from "./x.js"` and bare `import "./x.js"`. A
    // dynamic `import("./x.js")` is a lazy chunk and stays out of the initial graph.
    for (const match of source
      .toString('utf8')
      .matchAll(/\bimport\s*(?:[^"'()]*?\bfrom\s*)?["']\.\/([^"']+)["']/g)) {
      visit(match[1] ?? '');
    }
  };
  for (const entry of entries) visit(entry);
  return total;
}

/** The root page's own rows, plus dist-wide fonts, drone SVG and resume.pdf. */
export function checkShellAndAssets(dist) {
  const rows = [];
  const assets = join(dist, '_astro');
  const html = readFileSync(join(dist, 'index.html'), 'utf8');

  const gate = inlineScripts(html).find((body) => body.includes('vos:booted')) ?? '';
  rows.push(
    row(
      '/ head-gate inline JS',
      BUDGETS.headGate,
      byteLength(gate),
      'B',
      gate !== '' && byteLength(gate) <= BUDGETS.headGate,
    ),
  );

  // The island's initial JS: the entry module and the renderer, with their static imports.
  const island = html.match(
    /<astro-island[^>]*\bcomponent-url="([^"]+)"[^>]*\brenderer-url="([^"]+)"/,
  );
  const entries = island ? [island[1], island[2]] : [];
  const initial = graphBytes(
    assets,
    entries.map((url) => posix.basename(url ?? '')),
  );
  rows.push(
    row(
      '/ island initial JS',
      BUDGETS.islandInitial,
      initial,
      'B',
      entries.length > 0 && initial <= BUDGETS.islandInitial,
    ),
  );

  const scene = readdirSync(assets).find((name) => /^Scene\..+\.js$/.test(name));
  const sceneBytes = scene ? graphBytes(assets, [scene]) : 0;
  rows.push(
    row(
      '/ 3D scene chunk',
      BUDGETS.sceneChunk,
      sceneBytes,
      'B',
      scene !== undefined && sceneBytes <= BUDGETS.sceneChunk,
    ),
  );

  const fontDir = join(assets, 'fonts');
  const fonts = readdirSync(fontDir).reduce(
    (sum, name) => sum + gzipBytes(readFileSync(join(fontDir, name))),
    0,
  );
  rows.push(row('fonts total', BUDGETS.fonts, fonts, 'B'));

  const svg = html.match(/<svg[^>]*>(?:(?!<\/svg>)[\s\S])*<title>Wireframe model[\s\S]*?<\/svg>/);
  const svgBytes = svg ? gzipBytes(Buffer.from(svg[0])) : 0;
  rows.push(
    row(
      '/ drone SVG',
      BUDGETS.droneSvg,
      svgBytes,
      'B',
      svg !== null && svgBytes <= BUDGETS.droneSvg,
    ),
  );

  const pdf = gzipBytes(readFileSync(join(dist, 'resume.pdf')));
  rows.push(row('resume.pdf', BUDGETS.resumePdf, pdf, 'B'));
  return rows;
}

export function checkBudgets(dist) {
  return [...checkContentPages(dist), ...checkPageAssets(dist), ...checkShellAndAssets(dist)];
}

const fmt = (value, unit) => (unit === 'B' ? `${value} B` : String(value));

function printTable(rows) {
  const cells = [['row', 'budget', 'actual', 'result']];
  for (const r of rows)
    cells.push([r.name, fmt(r.budget, r.unit), fmt(r.actual, r.unit), r.ok ? 'pass' : 'FAIL']);
  const widths = cells[0].map((_, i) => Math.max(...cells.map((line) => line[i].length)));
  for (const line of cells) console.log(line.map((cell, i) => cell.padEnd(widths[i])).join('  '));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ?? 'dist';
  try {
    statSync(dist);
  } catch {
    console.error(`check-budgets: ${dist}/ not found; run \`pnpm build\` first.`);
    process.exit(1);
  }
  const rows = checkBudgets(dist);
  printTable(rows);
  const failed = rows.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\ncheck-budgets: ${failed.length} row(s) over budget.`);
    process.exit(1);
  }
  console.log(`\ncheck-budgets: ${rows.length} rows within budget.`);
}
