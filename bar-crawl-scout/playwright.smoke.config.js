import { defineConfig, devices } from '@playwright/test';

// Smoke runs against the LIVE site (no webServer, no mocks). Set LIVE_URL to
// override the default GitHub Pages URL.
export default defineConfig({
  testDir: './e2e/smoke',
  timeout: 30_000,
  retries: 2,
  reporter: 'line',
  // No baseURL on purpose — the site sits on a subpath, and baseURL+goto('/')
  // resolves to the origin root. Specs build absolute URLs from LIVE_URL.
  use: {
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
