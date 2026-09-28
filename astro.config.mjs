import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import siteGuard from './src/integrations/site-guard.ts';

export default defineConfig({
  // Placeholder origin (D3); the domain itself is out of scope. siteGuard fails
  // the build if this is ever unset or pointed at localhost.
  site: 'https://joe-valdez-portfolio.pages.dev',
  trailingSlash: 'always',
  output: 'static',
  // The shell does its own hover prefetch (ticket 09); content pages have no JS
  // to prefetch with, so Astro's built-in prefetch stays off (D4).
  prefetch: false,
  integrations: [react(), siteGuard()],
  // Ticket 13: the renamed IBM Plex Mono subset (`scripts/subset-fonts.py`),
  // self-hosted through Astro's local provider. Astro does not subset local
  // files itself, so the woff2 files are pre-subset and committed (D21).
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
      // Astro's automatic fallback only knows Courier New and is prepended
      // ahead of any listed fallback, silently shadowing the hand-written
      // Menlo/Consolas/DejaVu faces in src/styles/fonts.css (map Hazards).
      optimizedFallbacks: false,
      fallbacks: ['Valdez Mono Menlo', 'Valdez Mono Consolas', 'Valdez Mono DejaVu', 'monospace'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Left at the default of 1: Phase 7's incremental build cache turns off
    // above concurrency 1.
    concurrency: 1,
  },
  // Never add `vite.ssr.noExternal: ['@react-three/drei']` here — it breaks
  // `astro dev` with a `detect-gpu` CJS named-export error (map Hazards).
});
