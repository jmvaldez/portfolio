import type { AstroIntegration } from 'astro';

/**
 * Fails the build if `site` is unset or points at a local host. `og:image` and every
 * page's canonical URL derive from `site`, and Astro otherwise silently falls back to
 * `http://localhost:4321/...` in the output.
 */
export default function siteGuard(): AstroIntegration {
  return {
    name: 'site-guard',
    hooks: {
      'astro:config:done': ({ config }) => {
        const hostname = config.site ? new URL(config.site).hostname : undefined;
        if (!config.site || hostname === 'localhost' || hostname === '127.0.0.1') {
          throw new Error(
            'site must be set to the public origin; og:image and canonicals depend on it',
          );
        }
      },
    },
  };
}
