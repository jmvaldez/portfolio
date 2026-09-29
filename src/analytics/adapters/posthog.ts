// The PostHog adapter: the only module that imports `posthog-js` or knows PostHog's
// vocabulary (project keys, `$`-prefixed events, the capture endpoint, the cookieless
// sentinel). `provider.ts` loads it lazily, so neither it nor the SDK is in the shell's
// initial JS. Swapping providers means writing a sibling of this file; see the README.
//
// Two halves, one for each way the site talks to PostHog:
// - `createPosthog`: the SDK, for the desktop shell (`/`), where it also owns pageviews.
// - `posthogBeacon`: the inline script for content pages, which ship no external JS.
import type { Analytics } from '../types';

/** Same-origin path of the reverse proxy in `functions/ingest/[[path]].ts`. Keeps the
 * requests first-party, so blockers that match PostHog's own hosts don't drop them. */
const API_HOST = '/ingest';
/** US cloud, where the project lives. Only the toolbar and app links use it. */
const UI_HOST = 'https://us.posthog.com';

/** The SDK half. Catalogue names are already valid PostHog event names, so `track` passes
 * them through; only `page` maps onto PostHog's `$pageview`. */
export function createPosthog(key: string): Analytics {
  // Set by `init`; a `track` before then is a facade bug, and dropping it beats throwing.
  let client: typeof import('posthog-js').default | undefined;

  return {
    async init() {
      const { default: posthog } = await import('posthog-js');
      posthog.init(key, {
        api_host: API_HOST,
        ui_host: UI_HOST,
        defaults: '2026-05-30',
        // No cookies and no storage: identity is a hash PostHog computes server-side. Needs
        // "Cookieless server hash mode" switched on in the project's Web analytics settings.
        cookieless_mode: 'always',
        // Identity is never wanted in this mode, and this makes `identify()` a no-op.
        person_profiles: 'never',
        // Autocapture and pageviews stay on (`defaults` makes pageviews follow history
        // changes); replay is off.
        disable_session_recording: true,
      });
      client = posthog;
    },
    track(event, props) {
      client?.capture(event, props);
    },
    page() {
      client?.capture('$pageview');
    },
  };
}

/** A project key is `phc_` and URL-safe characters. Checked because it is spliced into an
 * inline script. */
const KEY_PATTERN = /^[\w-]+$/;

/**
 * The content-page pageview beacon: an inline script, minified by hand because content
 * pages have a 1.5 KB inline budget shared with the CRT script (see `check-budgets.mjs`).
 * It posts one cookieless `$pageview` to the capture endpoint through the proxy, carrying the
 * properties the SDK would (URL, host, path, referrer, user agent, screen and viewport sizes)
 * plus any `utm_*` parameters. The sentinel `distinct_id` and `$cookieless_mode` are what
 * make PostHog derive the visitor hash server-side, as it does for the SDK in
 * `cookieless_mode: 'always'`. Returns the script body, without a `<script>` tag.
 */
export function posthogBeacon(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error('posthogBeacon: malformed project key');
  return (
    'var l=location,s=screen,p={$cookieless_mode:!0,$process_person_profile:!1,' +
    '$current_url:l.href,$host:l.host,$pathname:l.pathname,$referrer:document.referrer,' +
    '$raw_user_agent:navigator.userAgent,$screen_width:s.width,$screen_height:s.height,' +
    '$viewport_width:innerWidth,$viewport_height:innerHeight};' +
    'new URLSearchParams(l.search).forEach(function(v,k){/^utm_/.test(k)&&(p[k]=v)});' +
    `navigator.sendBeacon('${API_HOST}/i/v0/e/',JSON.stringify({api_key:'${key}',` +
    "event:'$pageview',distinct_id:'$posthog_cookieless',properties:p}))"
  );
}
