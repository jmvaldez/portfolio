// The analytics reverse proxy: Cloudflare Pages serves every `/ingest/*` request through
// this function (`wrangler pages deploy` picks up `functions/` beside `dist/`). It keeps
// PostHog's requests first-party. Follows PostHog's Cloudflare proxy guide for US cloud:
// SDK assets and remote config (`/static/*`, `/array/*`) go to the assets host and are
// cached; everything else, including the `/i/v0/e/` capture endpoint, goes to the API host.
//
// Nothing in `src/` imports this. The adapter in `src/analytics/adapters/posthog.ts` only
// needs the `/ingest` path to exist.

const API_HOST = 'us.i.posthog.com';
const ASSET_HOST = 'us-assets.i.posthog.com';
const PREFIX = '/ingest';

async function retrieveAsset(
  request: Request,
  pathWithSearch: string,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const cached = await caches.default.match(request);
  if (cached) return cached;
  const response = await fetch(`https://${ASSET_HOST}${pathWithSearch}`);
  waitUntil(caches.default.put(request, response.clone()));
  return response;
}

async function forwardRequest(request: Request, pathWithSearch: string): Promise<Response> {
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
}

export const onRequest: PagesFunction = async ({ request, waitUntil }) => {
  const url = new URL(request.url);
  const path = url.pathname.slice(PREFIX.length) || '/';
  const pathWithSearch = path + url.search;

  const isAsset = path.startsWith('/static/') || path.startsWith('/array/');
  if (isAsset && (request.method === 'GET' || request.method === 'HEAD')) {
    return retrieveAsset(request, pathWithSearch, waitUntil);
  }
  return forwardRequest(request, pathWithSearch);
};
