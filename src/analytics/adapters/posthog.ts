// The PostHog adapter: the only module that knows PostHog's vocabulary (project keys,
// `$`-prefixed events and properties, the capture endpoint, the cookieless sentinel).
// `provider.ts` loads it lazily. There is no SDK: PostHog's own `posthog-js` is ~95 KB gzip,
// which is more than the whole shell, and this site wants three things from it, all of which
// are one POST. Swapping providers means writing a sibling of this file; see the README.
//
// Two halves, one for each way the site talks to PostHog:
// - `createPosthog`: the runtime adapter for the desktop shell (`/`), which sends the
//   catalogue's events and a pageview on init.
// - `posthogBeacon`: the inline script for content pages, which ship no external JS.
//
// Both send the same cookieless event: a fixed `distinct_id` sentinel and
// `$cookieless_mode`, from which PostHog derives a daily visitor hash on its servers, so
// no cookie or storage is ever touched. The beacon is hand-minified, so it can't call the
// runtime's property builder; `analytics.test.ts` runs both against one fake browser and
// requires identical payloads, which keeps them from drifting.
import type { Analytics } from '../types';

/** Same-origin path of the reverse proxy in `functions/ingest/[[path]].ts`. Keeps the
 * requests first-party, so blockers that match PostHog's own hosts don't drop them. */
const API_HOST = '/ingest';
/** PostHog's capture endpoint. */
const CAPTURE_URL = `${API_HOST}/i/v0/e/`;
const COOKIELESS_ID = '$posthog_cookieless';

/** The properties every event carries. `$host` and `$raw_user_agent` matter beyond
 * reporting: they are inputs to PostHog's server-side visitor hash. */
function baseProperties(): Record<string, unknown> {
  return {
    $cookieless_mode: true,
    $process_person_profile: false,
    $current_url: location.href,
    $host: location.host,
    $pathname: location.pathname,
    $referrer: document.referrer,
    $raw_user_agent: navigator.userAgent,
    $screen_width: screen.width,
    $screen_height: screen.height,
    $viewport_width: innerWidth,
    $viewport_height: innerHeight,
  };
}

/** The `utm_*` parameters of the current URL. */
function utmProperties(): Record<string, string> {
  const utm: Record<string, string> = {};
  new URLSearchParams(location.search).forEach((value, name) => {
    if (name.startsWith('utm_')) utm[name] = value;
  });
  return utm;
}

/** The runtime half. Catalogue names are already valid PostHog event names, so `track`
 * passes them through; only `page` maps onto PostHog's `$pageview`. */
export function createPosthog(key: string): Analytics {
  function send(event: string, properties: Record<string, unknown>): void {
    const body = JSON.stringify({
      api_key: key,
      event,
      distinct_id: COOKIELESS_ID,
      properties: { ...baseProperties(), ...properties },
    });
    try {
      if (navigator.sendBeacon(CAPTURE_URL, body)) return;
    } catch {
      // Fall through to `fetch`.
    }
    // The beacon queue was full or refused. Failures are swallowed: analytics never
    // surfaces to the visitor.
    fetch(CAPTURE_URL, { method: 'POST', body, keepalive: true }).catch(() => undefined);
  }

  const page = (): void => send('$pageview', utmProperties());

  return {
    // The desktop shell replaces the SDK's automatic pageview: one on start. The shell
    // never changes the URL, so there are no later ones.
    init() {
      page();
      return Promise.resolve();
    },
    track(event, props) {
      send(event, props);
    },
    page,
  };
}

/** A project key is `phc_` and URL-safe characters. Checked because it is spliced into an
 * inline script. */
const KEY_PATTERN = /^[\w-]+$/;

/**
 * The content-page pageview beacon: an inline script, minified by hand because content
 * pages have a 1.5 KB inline budget shared with the CRT script (see `check-budgets.mjs`).
 * It posts the same `$pageview` as the runtime adapter's `page()`, with the same properties.
 * Returns the script body, without a `<script>` tag.
 */
export function posthogBeacon(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error('posthogBeacon: malformed project key');
  return (
    'var l=location,s=screen,p={$cookieless_mode:!0,$process_person_profile:!1,' +
    '$current_url:l.href,$host:l.host,$pathname:l.pathname,$referrer:document.referrer,' +
    '$raw_user_agent:navigator.userAgent,$screen_width:s.width,$screen_height:s.height,' +
    '$viewport_width:innerWidth,$viewport_height:innerHeight};' +
    'new URLSearchParams(l.search).forEach(function(v,k){/^utm_/.test(k)&&(p[k]=v)});' +
    `navigator.sendBeacon('${CAPTURE_URL}',JSON.stringify({api_key:'${key}',` +
    `event:'$pageview',distinct_id:'${COOKIELESS_ID}',properties:p}))`
  );
}
