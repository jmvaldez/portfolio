import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from './[[path]]';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Runs the proxy for one request and returns the response plus what it forwarded. `country`
 * stands in for Cloudflare's `request.cf.country`. */
async function proxy(
  path: string,
  init: RequestInit,
  country?: string,
): Promise<{ response: Response; forwarded: Request | null }> {
  let forwarded: Request | null = null;
  vi.stubGlobal('fetch', (request: Request) => {
    forwarded = request;
    return Promise.resolve(new Response('upstream', { status: 202 }));
  });
  const request = new Request(`https://site.example/ingest${path}`, init);
  if (country) Object.defineProperty(request, 'cf', { value: { country } });
  const response = await onRequest({ request } as unknown as Parameters<typeof onRequest>[0]);
  return { response, forwarded };
}

const post = (body: BodyInit, userAgent = CHROME): RequestInit => ({
  method: 'POST',
  body,
  headers: { 'User-Agent': userAgent, Cookie: 'a=b', 'CF-Connecting-IP': '203.0.113.9' },
});

afterEach(() => vi.unstubAllGlobals());

describe('the /ingest proxy', () => {
  it('enriches a capture POST and forwards it to PostHog', async () => {
    const event = { event: '$pageview', properties: { $referrer: '' } };
    const { response, forwarded } = await proxy('/i/v0/e/?ip=0', post(JSON.stringify(event)), 'FR');

    expect(response.status).toBe(202);
    expect(forwarded?.url).toBe('https://us.i.posthog.com/i/v0/e/?ip=0');
    expect(forwarded?.headers.get('cookie')).toBeNull();
    expect(forwarded?.headers.get('x-forwarded-for')).toBe('203.0.113.9');
    const body = await forwarded!.json<{ properties: Record<string, unknown> }>();
    expect(body.properties).toMatchObject({
      $referrer: '$direct',
      $browser: 'Chrome',
      $geoip_country_code: 'FR',
    });
    // The IP is only ever in the header, never in the event.
    expect(JSON.stringify(body)).not.toContain('203.0.113.9');
  });

  it('answers 200 and forwards nothing for a bot', async () => {
    const { response, forwarded } = await proxy(
      '/i/v0/e/',
      post('{"event":"x"}', 'Mozilla/5.0 (compatible; Googlebot/2.1)'),
    );
    expect(response.status).toBe(200);
    expect(forwarded).toBeNull();
  });

  it('forwards a body it cannot parse byte for byte', async () => {
    const garbage = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe, 0x80]);
    const { forwarded } = await proxy('/i/v0/e/?compression=gzip-js', post(garbage));
    expect(new Uint8Array(await forwarded!.arrayBuffer())).toEqual(garbage);
  });

  it('passes non-capture requests through unchanged', async () => {
    const body = '{"event":"x"}';
    const { forwarded } = await proxy('/flags/?v=2', post(body));
    expect(await forwarded!.text()).toBe(body);
    expect(forwarded?.url).toBe('https://us.i.posthog.com/flags/?v=2');
  });

  it('does not enrich a GET', async () => {
    const { forwarded } = await proxy('/i/v0/e/', { method: 'GET' });
    expect(forwarded?.method).toBe('GET');
    expect(await forwarded!.text()).toBe('');
  });
});
