// The analytics reverse proxy: Cloudflare Pages serves every `/ingest/*` request through
// this function (`wrangler pages deploy` picks up `functions/` beside `dist/`). It keeps
// PostHog's requests first-party. Follows PostHog's Cloudflare proxy guide for US cloud,
// minus the asset routing (`/static/*`, `/array/*`): the site loads no PostHog SDK, so the
// only traffic is events POSTed to the capture endpoint, `/i/v0/e/`.
//
// Nothing in `src/` imports this. The adapter in `src/analytics/adapters/posthog.ts` only
// needs the `/ingest` path to exist.

const API_HOST = 'us.i.posthog.com';
const PREFIX = '/ingest';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const pathWithSearch = (url.pathname.slice(PREFIX.length) || '/') + url.search;

  const headers = new Headers(request.headers);
  // First-party cookies and credentials never leave for PostHog. The client IP does, so
  // PostHog sees the visitor's location (and, in cookieless mode, hashes it) and not
  // Cloudflare's.
  headers.delete('cookie');
  headers.delete('authorization');
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') ?? '');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return fetch(
    new Request(`https://${API_HOST}${pathWithSearch}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : null,
      redirect: request.redirect,
    }),
  );
};
