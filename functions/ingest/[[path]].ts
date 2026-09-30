// The analytics reverse proxy: Cloudflare Pages serves every `/ingest/*` request through
// this function (`wrangler pages deploy` picks up `functions/` beside `dist/`). It keeps
// PostHog's requests first-party. Follows PostHog's Cloudflare proxy guide for US cloud,
// minus the asset routing (`/static/*`, `/array/*`): the site loads no PostHog SDK, so the
// only traffic is events POSTed to the capture endpoint, `/i/v0/e/`.
//
// Capture requests are also enriched on the way through (`enrich.ts`): the channel inputs,
// user agent and country that the SDK would have added on the client. Bots are answered 200
// and dropped, since cookieless mode turns off PostHog's own bot detection. Everything else
// is forwarded as is.
//
// Nothing in `src/` imports this. The adapter in `src/analytics/adapters/posthog.ts` only
// needs the `/ingest` path to exist.
import { enrichBody, isBot, isCapturePath } from './enrich';

const API_HOST = 'us.i.posthog.com';
const PREFIX = '/ingest';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.pathname.slice(PREFIX.length) || '/';
  const pathWithSearch = path + url.search;

  const headers = new Headers(request.headers);
  // First-party cookies and credentials never leave for PostHog. The client IP does, so
  // PostHog sees the visitor's location (and, in cookieless mode, hashes it) and not
  // Cloudflare's.
  headers.delete('cookie');
  headers.delete('authorization');
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') ?? '');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let body: ArrayBuffer | null = hasBody ? await request.arrayBuffer() : null;

  if (body && request.method === 'POST' && isCapturePath(path)) {
    const userAgent = request.headers.get('User-Agent') ?? '';
    if (isBot(userAgent)) return new Response('{"status":1}', { status: 200 });

    // A compressed body (a `Content-Encoding`, or the SDK's `compression=` parameter) isn't
    // JSON text, and `enrichBody` returns `null` for it, so it passes through untouched.
    const enriched = enrichBody(body, { userAgent, country: request.cf?.country });
    if (enriched !== null) {
      body = new TextEncoder().encode(enriched).buffer as ArrayBuffer;
      // The length changed; `fetch` recomputes it.
      headers.delete('content-length');
    }
  }

  return fetch(
    new Request(`https://${API_HOST}${pathWithSearch}`, {
      method: request.method,
      headers,
      body,
      redirect: request.redirect,
    }),
  );
};
