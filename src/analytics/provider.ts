// The one place a provider is chosen. `PUBLIC_POSTHOG_KEY` unset (dev, CI, e2e, forks) means
// the noop adapter and no beacon: nothing is emitted and nothing loads. To switch vendors,
// write a new adapter under `adapters/` and point the two functions below at it.
//
// Both are lazy, so the vendor module (and its SDK) stay out of the shell's initial JS.
import { noopAnalytics } from './noop';
import type { Analytics } from './types';

/** The configured project key, or `undefined`. Empty counts as unset: an unset GitHub
 * secret arrives as `''`. */
export function analyticsKey(): string | undefined {
  return import.meta.env.PUBLIC_POSTHOG_KEY || undefined;
}

/** The runtime adapter for the desktop shell, for a project `key` (`analyticsKey()`). */
export async function loadAdapter(key: string | undefined): Promise<Analytics> {
  if (!key) return noopAnalytics;
  const { createPosthog } = await import('./adapters/posthog');
  return createPosthog(key);
}

/** The inline pageview script body for content pages, or `null` when there is none. Takes
 * the key as a parameter so tests can exercise both cases in one build. */
export async function loadBeacon(key: string | undefined): Promise<string | null> {
  if (!key) return null;
  const { posthogBeacon } = await import('./adapters/posthog');
  return posthogBeacon(key);
}
