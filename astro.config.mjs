import { defineConfig } from 'astro/config';
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
