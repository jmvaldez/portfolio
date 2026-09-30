// Server-side enrichment of analytics events, as pure functions (the proxy in `[[path]].ts`
// does the I/O). The site sends PostHog no SDK, so nothing on the client fills in what the
// SDK used to: the referrer's channel inputs, the parsed user agent, the country. Doing it
// here costs pages zero bytes. Values follow posthog-js exactly (`@posthog/browser-common`
// `event-utils` for referrer and campaign properties, `@posthog/core` `user-agent-utils` for
// the browser/OS/device vocabulary), so PostHog's breakdowns group them with SDK-sent data.
//
// Enrichment must never break ingestion: anything unexpected returns `null`, and the caller
// forwards the original bytes untouched.

/** What the request itself knows. */
export interface EnrichContext {
  /** The request's `User-Agent` header. */
  userAgent: string;
  /** Cloudflare's `request.cf.country` (ISO 3166-1 alpha-2), if any. */
  country: string | undefined;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Missing means absent or null; an empty string is a real (if useless) value. */
const missing = (props: Json, name: string): boolean => props[name] == null;

// --- Bots ---------------------------------------------------------------------------------
// Cookieless server hash mode turns off PostHog's own bot detection (its IP handling is
// skipped), so obvious automation is dropped here instead.

const BOT_PATTERN =
  /(?<!cu)bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|phantomjs|puppeteer|playwright|selenium|python-requests|python-urllib|go-http-client|curl\/|wget\/|libwww|httpclient|facebookexternalhit|preview|monitor|uptime/i;

/** Whether a user agent is obviously automated. */
export function isBot(userAgent: string): boolean {
  return BOT_PATTERN.test(userAgent);
}

// --- Referrer and campaign ----------------------------------------------------------------
// posthog-js: `$referrer` is `document.referrer || '$direct'`; `$referring_domain` is the
// referrer URL's `host` (port included) or `'$direct'`. PostHog's channel type is derived
// from the session's entry `$referring_domain`, `utm_*` and the ad-click ids `gclid` and
// `gad_source`, so the last three are lifted from `$current_url` when the client sent none.

const DIRECT = '$direct';
const CAMPAIGN_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'gad_source',
];

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host || undefined;
  } catch {
    return undefined;
  }
}

function enrichReferrer(props: Json): void {
  const referrer = props['$referrer'];
  if (typeof referrer !== 'string' || referrer === '') props['$referrer'] = DIRECT;

  if (missing(props, '$referring_domain') || props['$referring_domain'] === '') {
    const current = props['$referrer'];
    props['$referring_domain'] =
      typeof current === 'string' && current !== DIRECT ? (hostOf(current) ?? DIRECT) : DIRECT;
  }
}

function enrichCampaign(props: Json): void {
  const url = props['$current_url'];
  if (typeof url !== 'string') return;
  let search: URLSearchParams;
  try {
    search = new URL(url).searchParams;
  } catch {
    return;
  }
  for (const name of CAMPAIGN_PARAMS) {
    const value = search.get(name);
    if (value && missing(props, name)) props[name] = value;
  }
}

// --- User agent ---------------------------------------------------------------------------
// A compact port of posthog-js's detectors for the browsers, systems and devices that
// matter for a portfolio; consoles, e-readers and the like fall through to `Desktop` or
// `Mobile` as posthog-js does for an unknown device. Server-side there is no
// `navigator.vendor`, `userAgentData` or touch points, so iPadOS (which reports as a Mac) reads
// as desktop, and Brave as Chrome, exactly where the SDK would need those hints.

const has = (ua: string, part: string): boolean => ua.includes(part);

function detectBrowser(ua: string): string {
  if (has(ua, ' OPR/')) return has(ua, 'Mini') ? 'Opera Mini' : 'Opera';
  if (has(ua, 'IEMobile') || has(ua, 'WPDesktop')) return 'Internet Explorer Mobile';
  if (has(ua, 'SamsungBrowser')) return 'Samsung Internet';
  if (has(ua, 'Edge') || has(ua, 'Edg/')) return 'Microsoft Edge';
  if (has(ua, 'Vivaldi/')) return 'Vivaldi';
  if (has(ua, 'YaBrowser/')) return 'Yandex';
  if (has(ua, 'DuckDuckGo/') || has(ua, 'Ddg/')) return 'DuckDuckGo';
  if (has(ua, 'CriOS')) return 'Chrome iOS';
  if (has(ua, 'CrMo') || has(ua, 'Chrome')) return 'Chrome';
  if (has(ua, 'Android') && has(ua, 'Safari')) return 'Android Mobile';
  if (has(ua, 'FxiOS')) return 'Firefox iOS';
  if (has(ua, 'Safari') && !has(ua, 'Chrome') && !has(ua, 'Android')) {
    return has(ua, 'Mobile') ? 'Mobile Safari' : 'Safari';
  }
  if (has(ua, 'Firefox')) return 'Firefox';
  if (has(ua, 'MSIE') || has(ua, 'Trident/')) return 'Internet Explorer';
  if (has(ua, 'Gecko')) return 'Firefox';
  return '';
}

const VERSION = '(\\d+(\\.\\d+)?)';
const VERSION_REGEXES: Record<string, RegExp> = {
  'Internet Explorer Mobile': new RegExp('rv:' + VERSION),
  'Microsoft Edge': new RegExp('Edge?\\/' + VERSION),
  Chrome: new RegExp('(Chrome|CrMo)\\/' + VERSION),
  'Chrome iOS': new RegExp('CriOS\\/' + VERSION),
  Safari: new RegExp('Version/' + VERSION),
  'Mobile Safari': new RegExp('Version/' + VERSION),
  Opera: new RegExp('(Opera|OPR)\\/' + VERSION),
  Firefox: new RegExp('Firefox\\/' + VERSION),
  'Firefox iOS': new RegExp('FxiOS\\/' + VERSION),
  'Android Mobile': new RegExp('android\\s' + VERSION, 'i'),
  'Samsung Internet': new RegExp('SamsungBrowser\\/' + VERSION),
  Vivaldi: new RegExp('Vivaldi\\/' + VERSION),
  Yandex: new RegExp('YaBrowser\\/' + VERSION),
  DuckDuckGo: new RegExp('(DuckDuckGo|Ddg)\\/' + VERSION),
  'Internet Explorer': new RegExp('(rv:|MSIE )' + VERSION),
};

function detectBrowserVersion(ua: string, browser: string): number | undefined {
  const match = VERSION_REGEXES[browser]?.exec(ua);
  // The version is always the second-to-last group: the last is its optional decimals.
  return match ? parseFloat(match[match.length - 2] ?? '') : undefined;
}

const WINDOWS_VERSIONS: Record<string, string> = {
  'NT3.51': 'NT 3.11',
  'NT4.0': 'NT 4.0',
  '5.0': '2000',
  '5.1': 'XP',
  '5.2': 'XP',
  '6.0': 'Vista',
  '6.1': '7',
  '6.2': '8',
  '6.3': '8.1',
  '6.4': '10',
  '10.0': '10',
};

/** `[os, version]`, first matching rule wins, in posthog-js's order. */
function detectOS(ua: string): [string, string] {
  if (/Windows/i.test(ua)) {
    if (/Phone|WPDesktop/.test(ua)) return ['Windows Phone', ''];
    if (/Mobile/.test(ua) && !/IEMobile\b/.test(ua)) return ['Windows Mobile', ''];
    const nt = /Windows NT ([0-9.]+)/i.exec(ua)?.[1];
    if (nt) return ['Windows', /arm/i.test(ua) ? 'RT' : (WINDOWS_VERSIONS[nt] ?? '')];
    return ['Windows', ''];
  }
  const ios = /((iPhone|iPad|iPod).*?OS (\d+)_(\d+)_?(\d+)?|iPhone)/.exec(ua);
  if (ios) return ['iOS', ios[3] ? `${ios[3]}.${ios[4] ?? ''}.${ios[5] ?? '0'}` : ''];
  const android = /Android (\d+)\.(\d+)\.?(\d+)?|Android/i.exec(ua);
  if (android) {
    return ['Android', android[1] ? `${android[1]}.${android[2] ?? ''}.${android[3] ?? '0'}` : ''];
  }
  const mac = /Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/i.exec(ua);
  if (mac) return ['Mac OS X', `${mac[1]}.${mac[2] ?? ''}.${mac[3] ?? '0'}`];
  if (/Mac/i.test(ua)) return ['Mac OS X', ''];
  if (/CrOS/.test(ua)) return ['Chrome OS', ''];
  if (/Linux|debian/i.test(ua)) return ['Linux', ''];
  return ['', ''];
}

/** posthog-js's `$device`; empty for a desktop. */
function detectDevice(ua: string): string {
  if (/Windows Phone|WPDesktop/i.test(ua)) return 'Windows Phone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPod/.test(ua)) return 'iPod Touch';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/(Android|ZTE)/i.test(ua)) {
    // An Android UA without "Mobile" is a tablet, except for phones known to omit it.
    if (
      /Mobile/.test(ua) &&
      !/(9138B|TB782B|Nexus [97]|pixel c|HUAWEISHT|BTV|noble nook|smart ultra 6)/i.test(ua)
    ) {
      return 'Android';
    }
    if (
      (/pixel[\daxl ]{1,6}/i.test(ua) && !/pixel c/i.test(ua)) ||
      /(huaweimed-al00|tah-|APA|SM-G92|i980|zte|U304AA)/i.test(ua) ||
      (/lmy47v/i.test(ua) && !/QTAQZ3/i.test(ua))
    ) {
      return 'Android';
    }
    return 'Android Tablet';
  }
  if (/(pda|Mobile)/i.test(ua)) return 'Generic mobile';
  if (/Tablet/i.test(ua) && !/Tablet pc/i.test(ua)) return 'Generic tablet';
  return '';
}

function detectDeviceType(device: string): string {
  if (device === 'iPad' || device === 'Android Tablet' || device === 'Generic tablet') {
    return 'Tablet';
  }
  return device ? 'Mobile' : 'Desktop';
}

export interface ParsedUserAgent {
  $browser?: string;
  $browser_version?: number;
  $os?: string;
  $os_version?: string;
  $device?: string;
  $device_type: string;
}

/** The properties posthog-js derives from a user agent, with its vocabulary. Empty values
 * are left out, as posthog-js does. */
export function parseUserAgent(ua: string): ParsedUserAgent {
  const browser = detectBrowser(ua);
  const version = detectBrowserVersion(ua, browser);
  const [os, osVersion] = detectOS(ua);
  const device = detectDevice(ua);
  return {
    ...(browser ? { $browser: browser } : {}),
    ...(version !== undefined && !Number.isNaN(version) ? { $browser_version: version } : {}),
    ...(os ? { $os: os } : {}),
    ...(osVersion ? { $os_version: osVersion } : {}),
    ...(device ? { $device: device } : {}),
    $device_type: detectDeviceType(device),
  };
}

// --- Country ------------------------------------------------------------------------------

/** Cloudflare reports `XX` for unknown and `T1` for Tor; neither is a country. */
const NOT_A_COUNTRY = new Set(['XX', 'T1']);

function countryName(code: string): string | undefined {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
  } catch {
    return undefined;
  }
}

/** Nothing finer than the country is ever set. */
function enrichCountry(props: Json, country: string | undefined): void {
  const code = country?.toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code) || NOT_A_COUNTRY.has(code)) return;
  if (missing(props, '$geoip_country_code')) props['$geoip_country_code'] = code;
  if (missing(props, '$geoip_country_name')) {
    const name = countryName(code);
    if (name && name !== code) props['$geoip_country_name'] = name;
  }
}

// --- Events -------------------------------------------------------------------------------

function enrichEvent(event: unknown, context: EnrichContext): unknown {
  if (!isObject(event)) return event;
  const props: Json = isObject(event['properties']) ? { ...event['properties'] } : {};

  enrichReferrer(props);
  enrichCampaign(props);
  for (const [name, value] of Object.entries(parseUserAgent(context.userAgent))) {
    if (missing(props, name)) props[name] = value;
  }
  enrichCountry(props, context.country);

  return { ...event, properties: props };
}

/** The events of a capture body: a single event, an array, or `{batch: [...]}`. */
function mapEvents(body: unknown, fn: (event: unknown) => unknown): unknown {
  if (Array.isArray(body)) return body.map(fn);
  if (isObject(body) && Array.isArray(body['batch'])) {
    return { ...body, batch: body['batch'].map(fn) };
  }
  return fn(body);
}

/**
 * Enriches a capture request's body. Returns the new body text, or `null` when the body
 * should be forwarded untouched: it isn't valid UTF-8 JSON (compressed, base64, form
 * encoded) or isn't an event, batch or array of them.
 */
export function enrichBody(bytes: ArrayBuffer, context: EnrichContext): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return null;
  }
  if (!isObject(parsed) && !Array.isArray(parsed)) return null;
  try {
    return JSON.stringify(mapEvents(parsed, (event) => enrichEvent(event, context)));
  } catch {
    return null;
  }
}

/** Whether a request path is a capture endpoint (the site sends `/i/v0/e/`; PostHog's older
 * `/e/`, `/capture/` and batch endpoints are covered for completeness). */
export function isCapturePath(path: string): boolean {
  return /^\/(i\/v0\/e|e|capture|batch)\/?$/.test(path);
}
