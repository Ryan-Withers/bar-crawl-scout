// THE HEALTH INSPECTOR — post-deploy smoke (Fable File 03, Part 4.1).
// Runs against the LIVE deployed URL with the REAL API (in Actions, not the
// mocked preview). Kept lean and lenient — it's an is-it-up check, not a data
// audit (offseason means sparse live data).
import { test, expect } from '@playwright/test';

// The site lives on a SUBPATH (github.io/bar-crawl-scout/), so never goto('/')
// against baseURL — that resolves to the origin root. Build absolute URLs.
const LIVE = (process.env.LIVE_URL || 'https://ryan-withers.github.io/bar-crawl-scout/').replace(/\/?$/, '/');

test('the live hub loads with the sign lit and the nav present', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(LIVE);
  await expect(page.getByLabel('Bar Crawl Scout')).toBeVisible();
  await expect(page.getByRole('link', { name: /the book/i }).first()).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('The Book renders on the live site', async ({ page }) => {
  await page.goto(LIVE + '#/book');
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
});
