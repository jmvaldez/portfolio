#!/usr/bin/env node
/**
 * Post-build PDF render: prints `/resume/` from the built `dist/` to `dist/resume.pdf`.
 * Run after `astro build` as the second half of `pnpm build`, never on its own.
 *
 * Serves `dist/` with `astro preview` rather than a generic static server so the
 * document Chromium prints is byte-identical to what a visitor gets in production. It
 * prints through the print stylesheet (`src/styles/print.css`), the same one a
 * visitor's browser Print dialog uses.
 *
 * Needs a real browser, which is why the build runs in GitHub Actions rather than
 * Cloudflare Pages' own git builds.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { stat, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

// Distinct from `astro dev`'s 4321 and `pnpm preview`'s 4321 (playwright.config.ts), so
// this preview never collides with either during a local `pnpm verify`.
const PORT = 4322;
const BASE_URL = `http://localhost:${PORT}`;
const MAX_BYTES = 150 * 1024; // resume.pdf hard budget.
const WARN_PAGES = 2; // Soft target: warn only.

/** Polls `url` until it responds or `timeoutMs` elapses. */
async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  throw new Error(`astro preview did not respond at ${url} within ${timeoutMs}ms`);
}

async function main() {
  const preview = spawn('pnpm', ['exec', 'astro', 'preview', '--port', String(PORT)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Astro 7 auto-backgrounds `preview`/`dev` when it detects an agent-style sandbox.
      // The server must stay in the foreground of this child process so it keeps serving
      // while Playwright drives it.
      ASTRO_PREVIEW_BACKGROUND: '1',
    },
  });

  let browser;
  try {
    await waitForServer(BASE_URL);

    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/resume/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const pdfBytes = await page.pdf({
      format: 'Letter',
      printBackground: false,
      preferCSSPageSize: true,
    });

    await writeFile('dist/resume.pdf', pdfBytes);

    // Two pages is a soft target, so this only warns.
    const doc = await PDFDocument.load(pdfBytes);
    const pageCount = doc.getPageCount();
    if (pageCount > WARN_PAGES) {
      console.warn(`resume.pdf: ${pageCount} pages, past the ${WARN_PAGES}-page soft target.`);
    }

    // "Plex" is an OFL Reserved Font Name: the embedded font must be the renamed
    // "Valdez Mono" subset, never the original family name.
    const raw = pdfBytes.toString('latin1');
    if (raw.includes('Plex')) {
      throw new Error(
        'resume.pdf: embedded font still names "Plex" — the OFL Reserved Font Name must not ' +
          'leak into the PDF.',
      );
    }

    // Hard budget.
    const { size } = await stat('dist/resume.pdf');
    if (size > MAX_BYTES) {
      throw new Error(`resume.pdf: ${size} bytes exceeds the ${MAX_BYTES}-byte budget.`);
    }

    console.log(`resume.pdf: ${size} bytes, ${pageCount} page(s).`);
  } finally {
    await browser?.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
