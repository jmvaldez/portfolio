// Lighthouse CI, desktop preset: `/` with the shell (ticket 19 § Lab vitals). The boot screen
// is the LCP element. Mobile-preset runs live in lighthouserc.cjs.
const KB = 1024;

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      url: ['http://localhost/'],
      settings: { preset: 'desktop' },
    },
    assert: {
      aggregationMethod: 'median',
      assertions: {
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
        'resource-summary:font:size': ['error', { maxNumericValue: 60 * KB }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 20 * KB }],
        // Shell initial JS (<= 90 KB) plus the lazy 3D chunk (<= 250 KB) once the gate opens.
        'resource-summary:script:size': ['error', { maxNumericValue: 340 * KB }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 1500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
