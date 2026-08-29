// IS THIS THE BUILD I JUST PUSHED?
//
// GitHub Pages caches index.html, so after a deploy a browser holding the page
// can keep serving the old bundle for several minutes. From the outside that is
// indistinguishable from a change that never shipped — which is a bad thing to
// be wondering about the week of a draft.
//
// Every build writes its id to version.json; the running page re-reads that file
// with cache: 'no-store' and offers a reload when it has fallen behind.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('says nothing when the page IS the deployed build', async ({ page }) => {
  // Served from a real build, so the id in the bundle and the id in the file
  // agree. A banner here would be crying wolf on every single page load.
  await page.goto('./');
  await expect(page.getByTestId('sheet')).toHaveCount(0);
  await page.waitForTimeout(500);
  await expect(page.getByTestId('new-version')).toHaveCount(0);

  // ...and it can still tell you which build that is.
  const build = await page.evaluate(() => document.documentElement.dataset.build);
  expect(build, 'the page stamps its own build id').toBeTruthy();
});

test('offers a reload once a newer build is out there', async ({ page }) => {
  await page.route('**/version.json*', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'a-later-build', built: new Date().toISOString() }),
  }));
  await page.goto('./');
  await expect(page.getByTestId('new-version')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('new-version')).toContainText('New version');
});

test('the reload actually reloads', async ({ page }) => {
  let served = 0;
  await page.route('**/version.json*', (r) => {
    served++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'a-later-build' }) });
  });
  await page.goto('./');
  const pill = page.getByTestId('new-version');
  await expect(pill).toBeVisible({ timeout: 10_000 });
  const before = served;
  await pill.click();
  await page.waitForLoadState('load');
  await expect.poll(() => served).toBeGreaterThan(before);
});

test('stays quiet when version.json is missing or unreadable', async ({ page }) => {
  // An older deploy has no version.json at all, and offline has nothing. Neither
  // is worth a banner: the page in front of you is still the page.
  const errors = trackErrors(page);
  await page.route('**/version.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('./');
  await page.waitForTimeout(600);
  await expect(page.getByTestId('new-version')).toHaveCount(0);

  await page.route('**/version.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: 'not json at all' }));
  await page.reload();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('new-version')).toHaveCount(0);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('asks for the file at the app root, from any depth', async ({ page }) => {
  // Resolving against the current URL asks /bar-crawl-scout/player/version.json
  // on a player page — a 404, which would leave this silent on half the site.
  const asked = [];
  await page.route('**/version.json*', (r) => {
    asked.push(new URL(r.request().url()).pathname);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'a-later-build' }) });
  });
  await page.goto('./player/Josh%20Allen');
  await expect(page.getByTestId('new-version')).toBeVisible({ timeout: 10_000 });
  expect(asked.length).toBeGreaterThan(0);
  for (const p of asked) expect(p).toBe('/bar-crawl-scout/version.json');
});
