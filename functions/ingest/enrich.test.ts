import { describe, expect, it } from 'vitest';
import { enrichBody, isBot, isCapturePath, parseUserAgent, type EnrichContext } from './enrich';

const encode = (value: unknown): ArrayBuffer =>
  new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value))
    .buffer as ArrayBuffer;

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const context: EnrichContext = { userAgent: CHROME_WIN, country: 'DE' };

/** What the site's adapter sends for a pageview, minus what the server fills in. */
const pageview = (properties: Record<string, unknown> = {}) => ({
  api_key: 'phc_x',
  event: '$pageview',
  distinct_id: '$posthog_cookieless',
  properties: {
    $cookieless_mode: true,
    $current_url: 'https://example.com/about/',
    $referrer: '',
    ...properties,
  },
});

/** Enriches one event and returns its properties. */
function enrichedProps(event: ReturnType<typeof pageview>, ctx = context): Record<string, unknown> {
  const out = enrichBody(encode(event), ctx);
  return (JSON.parse(out ?? 'null') as { properties: Record<string, unknown> }).properties;
}

// Expected values are what posthog-js's own detectors (`@posthog/core` 1.55.2,
// `user-agent-utils`) return for the same strings, minus the empty ones it also omits.
const UA_TABLE: [string, string, Record<string, unknown>][] = [
  [
    'chrome_win',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    {
      $browser: 'Chrome',
      $browser_version: 120,
      $os: 'Windows',
      $os_version: '10',
      $device_type: 'Desktop',
    },
  ],
  [
    'safari_mac',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    {
      $browser: 'Safari',
      $browser_version: 17.1,
      $os: 'Mac OS X',
      $os_version: '10.15.7',
      $device_type: 'Desktop',
    },
  ],
  [
    'firefox_linux',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    { $browser: 'Firefox', $browser_version: 121, $os: 'Linux', $device_type: 'Desktop' },
  ],
  [
    'edge_win',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.77',
    {
      $browser: 'Microsoft Edge',
      $browser_version: 120,
      $os: 'Windows',
      $os_version: '10',
      $device_type: 'Desktop',
    },
  ],
  [
    'iphone_safari',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    {
      $browser: 'Mobile Safari',
      $browser_version: 17.1,
      $os: 'iOS',
      $os_version: '17.1.1',
      $device: 'iPhone',
      $device_type: 'Mobile',
    },
  ],
  [
    'ipad_safari',
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    {
      $browser: 'Mobile Safari',
      $browser_version: 16.6,
      $os: 'iOS',
      $os_version: '16.6.0',
      $device: 'iPad',
      $device_type: 'Tablet',
    },
  ],
  [
    'iphone_chrome',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1',
    {
      $browser: 'Chrome iOS',
      $browser_version: 119,
      $os: 'iOS',
      $os_version: '17.1.0',
      $device: 'iPhone',
      $device_type: 'Mobile',
    },
  ],
  [
    'iphone_firefox',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15',
    {
      $browser: 'Firefox iOS',
      $browser_version: 120,
      $os: 'iOS',
      $os_version: '17.1.0',
      $device: 'iPhone',
      $device_type: 'Mobile',
    },
  ],
  [
    'android_chrome',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    {
      $browser: 'Chrome',
      $browser_version: 120,
      $os: 'Android',
      $device: 'Android',
      $device_type: 'Mobile',
    },
  ],
  [
    'android_pixel',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    {
      $browser: 'Chrome',
      $browser_version: 120,
      $os: 'Android',
      $device: 'Android',
      $device_type: 'Mobile',
    },
  ],
  [
    'android_tablet',
    'Mozilla/5.0 (Linux; Android 12; SM-X906C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    {
      $browser: 'Chrome',
      $browser_version: 108,
      $os: 'Android',
      $device: 'Android Tablet',
      $device_type: 'Tablet',
    },
  ],
  [
    'samsung',
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    {
      $browser: 'Samsung Internet',
      $browser_version: 23,
      $os: 'Android',
      $device: 'Android',
      $device_type: 'Mobile',
    },
  ],
  [
    'android_old',
    'Mozilla/5.0 (Linux; U; Android 4.4.2; en-us; SM-T530NU Build/KOT49H) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30',
    {
      $browser: 'Android Mobile',
      $browser_version: 4.4,
      $os: 'Android',
      $os_version: '4.4.2',
      $device: 'Android Tablet',
      $device_type: 'Tablet',
    },
  ],
  [
    'opera',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0',
    {
      $browser: 'Opera',
      $browser_version: 105,
      $os: 'Windows',
      $os_version: '10',
      $device_type: 'Desktop',
    },
  ],
  [
    'ie11',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko',
    {
      $browser: 'Internet Explorer',
      $browser_version: 11,
      $os: 'Windows',
      $os_version: '7',
      $device_type: 'Desktop',
    },
  ],
  [
    'chromeos',
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    { $browser: 'Chrome', $browser_version: 120, $os: 'Chrome OS', $device_type: 'Desktop' },
  ],
  ['empty', '', { $device_type: 'Desktop' }],
  ['garbage', 'totally-not-a-browser', { $device_type: 'Desktop' }],
];

describe('parseUserAgent', () => {
  it.each(UA_TABLE)('%s matches posthog-js', (_name, ua, expected) => {
    expect(parseUserAgent(ua)).toEqual({ $device_type: 'Desktop', ...expected });
  });

  it('cannot tell iPadOS (which reports as a Mac) from a Mac', () => {
    expect(parseUserAgent(UA_TABLE.find(([name]) => name === 'safari_mac')![1])).toMatchObject({
      $os: 'Mac OS X',
      $device_type: 'Desktop',
    });
  });
});

describe('enrichBody: shapes', () => {
  it('enriches a single event', () => {
    const out = JSON.parse(enrichBody(encode(pageview()), context)!) as ReturnType<typeof pageview>;
    expect(out).toMatchObject({ event: '$pageview', distinct_id: '$posthog_cookieless' });
    expect(out.properties).toMatchObject({ $browser: 'Chrome', $geoip_country_code: 'DE' });
  });

  it('enriches every event of an array', () => {
    const out = JSON.parse(enrichBody(encode([pageview(), pageview()]), context)!) as unknown[];
    expect(out).toHaveLength(2);
    for (const event of out) {
      expect((event as ReturnType<typeof pageview>).properties).toMatchObject({ $os: 'Windows' });
    }
  });

  it('enriches every event of a {batch: [...]} body and keeps its other keys', () => {
    const body = { api_key: 'phc_x', sent_at: 't', batch: [pageview(), pageview()] };
    const out = JSON.parse(enrichBody(encode(body), context)!) as typeof body;
    expect(out.api_key).toBe('phc_x');
    expect(out.sent_at).toBe('t');
    expect(out.batch).toHaveLength(2);
    expect(out.batch[1]?.properties).toMatchObject({ $device_type: 'Desktop' });
  });

  it('adds properties to an event that has none', () => {
    const out = JSON.parse(enrichBody(encode({ event: 'x' }), context)!) as {
      properties: Record<string, unknown>;
    };
    expect(out.properties).toMatchObject({ $browser: 'Chrome', $referrer: '$direct' });
  });

  it('leaves non-event array members alone', () => {
    const out = JSON.parse(enrichBody(encode([1, 'a', null, pageview()]), context)!) as unknown[];
    expect(out.slice(0, 3)).toEqual([1, 'a', null]);
  });
});

describe('enrichBody: passthrough on anything unexpected', () => {
  it.each([
    ['garbage text', 'not json {'],
    ['a base64 form body', 'data=eyJldmVudCI6IngifQ%3D%3D'],
    ['a JSON string', '"hello"'],
    ['a JSON number', '42'],
    ['null', 'null'],
    ['an empty body', ''],
  ])('returns null for %s', (_name, body) => {
    expect(enrichBody(encode(body), context)).toBeNull();
  });

  it('returns null for a gzip body (invalid UTF-8)', () => {
    const gzip = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe, 0x80, 0x81]).buffer;
    expect(enrichBody(gzip, context)).toBeNull();
  });
});

describe('enrichBody: referrer and channel inputs', () => {
  it('turns an empty referrer into $direct for both properties', () => {
    expect(enrichedProps(pageview({ $referrer: '' }))).toMatchObject({
      $referrer: '$direct',
      $referring_domain: '$direct',
    });
  });

  it('turns a missing referrer into $direct too', () => {
    const event = pageview();
    delete (event.properties as Record<string, unknown>)['$referrer'];
    expect(enrichedProps(event)).toMatchObject({
      $referrer: '$direct',
      $referring_domain: '$direct',
    });
  });

  it("sets the referring domain to the referrer's host, port included", () => {
    expect(
      enrichedProps(pageview({ $referrer: 'https://www.google.com/search?q=x' })),
    ).toMatchObject({
      $referrer: 'https://www.google.com/search?q=x',
      $referring_domain: 'www.google.com',
    });
    expect(enrichedProps(pageview({ $referrer: 'http://localhost:3000/a' }))).toMatchObject({
      $referring_domain: 'localhost:3000',
    });
  });

  it('falls back to $direct for an unparseable referrer, and keeps a supplied domain', () => {
    expect(enrichedProps(pageview({ $referrer: 'not a url' }))).toMatchObject({
      $referrer: 'not a url',
      $referring_domain: '$direct',
    });
    expect(
      enrichedProps(
        pageview({ $referrer: 'https://a.example/', $referring_domain: 'kept.example' }),
      ),
    ).toMatchObject({ $referring_domain: 'kept.example' });
  });

  it('lifts campaign parameters and ad click ids from the URL, unless already sent', () => {
    const url = 'https://example.com/?utm_source=news&utm_medium=email&gclid=abc&gad_source=1&x=1';
    expect(enrichedProps(pageview({ $current_url: url }))).toMatchObject({
      utm_source: 'news',
      utm_medium: 'email',
      gclid: 'abc',
      gad_source: '1',
    });
    expect(enrichedProps(pageview({ $current_url: url, utm_source: 'sent' }))).toMatchObject({
      utm_source: 'sent',
    });
    expect(enrichedProps(pageview({ $current_url: url }))).not.toHaveProperty('x');
  });
});

describe('enrichBody: user agent', () => {
  it('only fills properties that are missing', () => {
    const props = enrichedProps(pageview({ $browser: 'Custom', $os: null }));
    expect(props['$browser']).toBe('Custom');
    expect(props['$os']).toBe('Windows');
  });

  it('parses the header UA the caller passes, not a client-supplied one', () => {
    const iphone = UA_TABLE.find(([name]) => name === 'iphone_safari')![1];
    expect(enrichedProps(pageview(), { ...context, userAgent: iphone })).toMatchObject({
      $browser: 'Mobile Safari',
      $device_type: 'Mobile',
      $os: 'iOS',
    });
  });

  it('keeps the header UA as $user_agent for bot classification, unless one was sent', () => {
    const iphone = UA_TABLE.find(([name]) => name === 'iphone_safari')![1];
    expect(enrichedProps(pageview(), { ...context, userAgent: iphone })['$user_agent']).toBe(
      iphone,
    );
    expect(enrichedProps(pageview({ $user_agent: 'sent' }))['$user_agent']).toBe('sent');
    expect(enrichedProps(pageview(), { ...context, userAgent: '' })).not.toHaveProperty(
      '$user_agent',
    );
  });
});

describe('enrichBody: country', () => {
  it('sets the country code and English name, and nothing finer', () => {
    const props = enrichedProps(pageview());
    expect(props['$geoip_country_code']).toBe('DE');
    expect(props['$geoip_country_name']).toBe('Germany');
    expect(Object.keys(props).filter((k) => k.startsWith('$geoip_'))).toEqual([
      '$geoip_country_code',
      '$geoip_country_name',
    ]);
  });

  it('skips an unknown or absent country, and does not overwrite a supplied one', () => {
    for (const country of [undefined, 'XX', 'T1', '', 'usa']) {
      expect(enrichedProps(pageview(), { ...context, country })).not.toHaveProperty(
        '$geoip_country_code',
      );
    }
    expect(enrichedProps(pageview({ $geoip_country_code: 'FR' }))).toMatchObject({
      $geoip_country_code: 'FR',
    });
  });

  it('accepts a lowercase code', () => {
    expect(enrichedProps(pageview(), { ...context, country: 'us' })).toMatchObject({
      $geoip_country_code: 'US',
      $geoip_country_name: 'United States',
    });
  });
});

describe('isBot', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11) Chrome/109 Mobile Safari/537.36 Chrome-Lighthouse',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (compatible; YandexSpider/3.0)',
    'python-requests/2.31.0',
    'curl/8.4.0',
  ])('flags %s', (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it('lets real browsers, and a phone named Cubot, through', () => {
    for (const [, ua] of UA_TABLE) expect(isBot(ua)).toBe(false);
    expect(
      isBot('Mozilla/5.0 (Linux; Android 10; Cubot X20) Chrome/120 Mobile Safari/537.36'),
    ).toBe(false);
  });
});

describe('isCapturePath', () => {
  it('matches the capture endpoints only', () => {
    for (const path of ['/i/v0/e/', '/i/v0/e', '/e/', '/capture/', '/batch/']) {
      expect(isCapturePath(path)).toBe(true);
    }
    for (const path of ['/', '/static/array.js', '/array/phc_x/config', '/decide/', '/i/v0/e/x']) {
      expect(isCapturePath(path)).toBe(false);
    }
  });
});
