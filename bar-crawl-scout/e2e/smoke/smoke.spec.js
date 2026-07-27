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
  await expect(page.getByTestId('sidebar').getByTestId('nav-book')).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('The Book renders on the live site', async ({ page }) => {
  await page.goto(LIVE + 'book');
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
});

// The exact failure Ryan hit: a deep link must load cold on the LIVE site
// (GitHub Pages serves 404.html -> the app boots on the real URL).
test('deep links load directly on the live site', async ({ page }) => {
  await page.goto(LIVE + 'myteam');
  // The shell names the page it opened. Asserting the H1 (not the brand mark)
  // proves the ROUTER resolved the deep link, rather than Pages just handing
  // back index.html and the app booting on the home page.
  await expect(page.getByRole('heading', { name: 'Lineup', level: 1 })).toBeVisible();
  await page.goto(LIVE + 'player/Joe%20Burrow');
  await expect(page.getByText(/Joe Burrow/i).first()).toBeVisible();
});
