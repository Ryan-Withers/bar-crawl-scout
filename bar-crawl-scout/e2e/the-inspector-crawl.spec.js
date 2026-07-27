// THE INSPECTOR'S CRAWL — the comprehensive "test all buttons" pass.
// For EVERY page: load it on its real URL, follow every internal link it
// renders (each must land on real content, never the Stub, never a 404), and
// click every enabled button (no uncaught errors, no page death).
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

const ROUTES = [
  'myteam', 'matchup', 'byes',
  'board', 'keepers', 'trade', 'intel', 'vault',
  'standings', 'power', 'playoffs', 'matchups', 'managers', 'history',
  'players', 'waivers',
  'book', 'leaderboard',
  'settings', 'sync',
  'player/Joe%20Burrow', 'managers/joshleota',
];
const STUB_TEXT = /this room opens in a later phase/i;

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('every internal link on every page lands on real content (no 404s, no stubs)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  const found = new Set();

  for (const r of ROUTES) {
    await page.goto('./' + r);
    await page.waitForTimeout(250);
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
    for (const h of hrefs) {
      if (!h || !h.startsWith('/bar-crawl-scout/')) continue;
      found.add(h.slice('/bar-crawl-scout/'.length));
    }
  }
  expect(found.size).toBeGreaterThan(20); // sanity: the crawl actually harvested links

  // Visit every harvested destination (cap the long player-list tail).
  const targets = [...found].slice(0, 80);
  for (const t of targets) {
    await page.goto('./' + t);
    await page.waitForTimeout(200);
    const body = await page.textContent('body');
    expect(body, `${t} rendered the stub/dead-end`).not.toMatch(STUB_TEXT);
    const h = await page.evaluate(() => document.body.scrollHeight);
    expect(h, `${t} looks empty`).toBeGreaterThan(300);
  }
  expect(errors, 'uncaught errors during link crawl:\n' + errors.join('\n')).toHaveLength(0);
});

test('every enabled button on every page can be clicked without an uncaught error', async ({ page }) => {
  test.setTimeout(240_000);
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const failures = [];

  // The PAGE's own buttons, not the shell's. The sidebar, tab bar, sync coaster
  // and search button are identical on all 22 routes — clicking them 22 times
  // adds no coverage (the-regular and the-phone drive them properly), and the
  // search button opens the command palette, which then covers everything else.
  const SEL = '[data-testid="content"] button:enabled:visible';

  for (const r of ROUTES) {
    const errors = trackErrors(page);
    await page.goto('./' + r);
    await page.waitForTimeout(250);
    const count = await page.locator(SEL).count();
    for (let i = 0; i < Math.min(count, 40); i++) {
      // A click can take most of the page's buttons with it — "switch" on The
      // Book logs you out and leaves one. Reload rather than ask for an index
      // that no longer exists, or every remaining one burns a full timeout.
      if (await page.locator(SEL).count() <= i) {
        await page.goto('./' + r);
        await page.waitForTimeout(200);
        if (await page.locator(SEL).count() <= i) break; // genuinely fewer buttons than we counted
      }
      const btn = page.locator(SEL).nth(i);
      const label = ((await btn.textContent().catch(() => '')) || '').trim().slice(0, 30) || '(unlabelled)';
      try {
        await btn.click({ timeout: 1500, trial: false });
        await page.waitForTimeout(80);
      } catch { /* covered/moved buttons are fine — we only hunt runtime errors */ }
      if (errors.length) { failures.push(`${r} -> "${label}": ${errors.splice(0).join(' | ')}`); }
      // A click may navigate; come back for the rest.
      if (!page.url().includes('/' + r.split('/')[0])) { await page.goto('./' + r); await page.waitForTimeout(200); }
    }
  }
  expect(failures, 'buttons that threw:\n' + failures.join('\n')).toHaveLength(0);
});
