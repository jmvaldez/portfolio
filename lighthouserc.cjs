// Lighthouse CI, mobile preset: content pages and the linear layout (`/` at a mobile
// viewport). The desktop-preset run of `/` lives in lighthouserc.desktop.cjs, because one
// LHCI collect has one preset; `pnpm lighthouse` runs both.
//
// Blocking (error): CLS and resource sizes. Warning only: LCP and TBT, which are too noisy
// on shared CI runners to gate on. A CLS failure on a content page means the fallback
// metrics in `src/styles/fonts.css` are wrong, not that the budget is.
const KB = 1024;

const CONTENT = '/(about|projects/aetherforge|drones/x500)/$';
const ROOT = '/$';

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      url: [
        'http://localhost/about/',
        'http://localhost/projects/aetherforge/',
        'http://localhost/drones/x500/',
        'http://localhost/',
      ],
      // No `preset`: Lighthouse's default form factor is mobile, and LHCI's own `preset`
      // choices are only perf/experimental/desktop.
    },
    assert: {
      assertMatrix: [
        {
          aggregationMethod: 'median',
          matchingUrlPattern: `${CONTENT}|${ROOT}`,
          assertions: {
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
            'resource-summary:font:size': ['error', { maxNumericValue: 60 * KB }],
            'resource-summary:stylesheet:size': ['error', { maxNumericValue: 20 * KB }],
            'largest-contentful-paint': ['warn', { maxNumericValue: 2000 }],
            'total-blocking-time': ['warn', { maxNumericValue: 50 }],
          },
        },
        {
          // Content pages ship no external script at all.
          aggregationMethod: 'median',
          matchingUrlPattern: CONTENT,
          assertions: {
            'resource-summary:script:size': ['error', { maxNumericValue: 0 }],
          },
        },
        {
          // The linear layout still mounts the island, so `/` may load the shell's initial JS
          // (<= 90 KB) but never the 3D chunk (<= 250 KB, and lazy behind the gate).
          aggregationMethod: 'median',
          matchingUrlPattern: ROOT,
          assertions: {
            'resource-summary:script:size': ['error', { maxNumericValue: 90 * KB }],
          },
        },
      ],
    },
    upload: { target: 'temporary-public-storage' },
  },
};
