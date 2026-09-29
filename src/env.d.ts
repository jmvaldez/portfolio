/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The analytics project key; unset means no analytics (see `src/analytics/provider.ts`). */
  readonly PUBLIC_POSTHOG_KEY?: string;
}
