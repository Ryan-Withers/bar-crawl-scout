import { defineConfig, devices } from '@playwright/test';

// E2E always runs against a built preview with Sleeper mocked (see mockSleeper).
// Chromium only; the mobile persona overrides the viewport per-spec via test.use.
export default defineConfig({
  testDir: './e2e',
  // smoke has its own config; the 4-minute full crawl runs nightly/on-demand (CRAWL=1), not per-PR.
  testIgnore: process.env.CRAWL ? ['**/smoke/**'] : ['**/smoke/**', '**/the-inspector-crawl*'],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://localhost:4173/bar-crawl-scout/',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/bar-crawl-scout/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
