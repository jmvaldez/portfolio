import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:4321/';

export default defineConfig({
  testDir: 'tests/e2e',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The e2e suite runs against the built site, never `astro dev` — dev hydrates
  // client:only islands twice in a hidden iframe (map Hazards).
  webServer: {
    command: 'pnpm preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
  },
});
