import { defineConfig, devices } from '@playwright/test';

// Smoke runs against the LIVE site (no webServer, no mocks). Set LIVE_URL to
// override the default GitHub Pages URL.
export default defineConfig({
  testDir: './e2e/smoke',
  timeout: 30_000,
  retries: 2,
  reporter: 'line',
  use: {
    baseURL: process.env.LIVE_URL || 'https://ryan-withers.github.io/bar-crawl-scout',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
