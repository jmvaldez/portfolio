import type { AstroIntegration } from 'astro';
import type { AddressInfo } from 'node:net';

/**
 * Serves `/resume.pdf` under `astro dev`. The real file is printed from the built site after
 * `astro build` (`scripts/build-resume-pdf.mjs`), so the dev server otherwise 404s on every
 * download link. This prints the dev server's own `/resume/` on each request with the same
 * Chromium settings; it is never part of a build.
 */
export default function devResumePdf(): AstroIntegration {
  return {
    name: 'dev-resume-pdf',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/resume.pdf', (_req, res) => {
          void (async () => {
            const { port } = server.httpServer?.address() as AddressInfo;
            const { chromium } = await import('@playwright/test');
            const browser = await chromium.launch();
            try {
              const page = await browser.newPage();
              await page.goto(`http://localhost:${port}/resume/`, { waitUntil: 'load' });
              await page.evaluate(() => document.fonts.ready);
              const pdf = await page.pdf({
                format: 'Letter',
                printBackground: false,
                preferCSSPageSize: true,
              });
              res.setHeader('Content-Type', 'application/pdf');
              res.end(pdf);
            } finally {
              await browser.close();
            }
          })().catch((error: unknown) => {
            res.statusCode = 500;
            res.end(`dev-resume-pdf: ${String(error)}`);
          });
        });
      },
    },
  };
}
