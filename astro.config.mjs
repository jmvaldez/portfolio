import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import siteGuard from './src/integrations/site-guard.ts';
import devResumePdf from './src/integrations/dev-resume-pdf.ts';
import { satteri } from '@astrojs/markdown-satteri';
import { externalLinksInNewTab } from './src/lib/external-links.ts';

export default defineConfig({
  // Placeholder origin; siteGuard fails the build if this is unset or points at
  // localhost.
  site: 'https://joe-valdez-portfolio.pages.dev',
  trailingSlash: 'always',
  output: 'static',
  // The shell does its own hover prefetch; content pages have no JS to prefetch with,
  // so Astro's built-in prefetch stays off.
  prefetch: false,
  // Sätteri is Astro's default processor; it's named here only to add a plugin.
  markdown: {
    processor: satteri({ hastPlugins: [externalLinksInNewTab] }),
  },
  integrations: [
    react(),
    siteGuard(),
    devResumePdf(),
    // Every page, minus the OG images, the raw fs body/source endpoints and the resume
    // PDF, none of which are pages.
    sitemap({
      filter: (page) => {
        const url = new URL(page);
        return (
          !url.pathname.includes('/og/') &&
          !url.pathname.includes('/fs/') &&
          url.pathname !== '/resume.pdf'
        );
      },
    }),
  ],
  // The renamed IBM Plex Mono subset (`scripts/subset-fonts.py`), self-hosted through
  // Astro's local provider. Astro doesn't subset local files, so the woff2 files are
  // pre-subset and committed.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Valdez Mono',
      cssVariable: '--font-mono',
      options: {
        variants: [
          {
            weight: '400',
            style: 'normal',
            src: ['./src/assets/fonts/valdez-mono-regular.woff2'],
          },
          {
            weight: '700',
            style: 'normal',
            src: ['./src/assets/fonts/valdez-mono-bold.woff2'],
          },
          {
            weight: '400',
            style: 'italic',
            src: ['./src/assets/fonts/valdez-mono-italic.woff2'],
          },
        ],
      },
      display: 'swap',
      // Astro's automatic fallback only knows Courier New and is prepended ahead of any
      // listed fallback, silently shadowing the hand-written Menlo/Consolas/DejaVu faces
      // in src/styles/fonts.css.
      optimizedFallbacks: false,
      fallbacks: ['Valdez Mono Menlo', 'Valdez Mono Consolas', 'Valdez Mono DejaVu', 'monospace'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Left at the default of 1: the incremental build cache (enabled below) turns off
    // entirely above concurrency 1.
    concurrency: 1,
  },
  experimental: {
    // Caches the OG endpoint's PNGs (and any other `cacheKey`-bearing route) across
    // builds, kept warm by `actions/cache` on `node_modules/.astro` in both workflows.
    // Requires `build.concurrency: 1` above.
    incrementalBuild: true,
  },
  // Never add `vite.ssr.noExternal: ['@react-three/drei']` here: it breaks `astro dev`
  // with a `detect-gpu` CJS named-export error.
});
