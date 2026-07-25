// THE TICKER — the league move feed on the Wire.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
];
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: {} },
  { roster_id: 2, owner_id: '2', settings: {} },
];
const PLAYERS_BLOB = {
  100: { full_name: 'Star RB', position: 'RB', team: 'ATL' },
  200: { full_name: 'Bust WR', position: 'WR', team: 'CHI' },
  300: { full_name: 'Sleeper TE', position: 'TE', team: 'DET' },
};
const TXN = {
  2: [{ type: 'waiver', status: 'complete', created: 1000, roster_ids: [1], adds: { 100: 1 }, drops: { 200: 1 }, settings: { waiver_bid: 37 } }],
  3: [{ type: 'trade', status: 'complete', created: 2000, roster_ids: [1, 2], adds: { 300: 1 }, drops: { 300: 2 } }],
};

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockWire(page) {
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const wk = url.match(/\/transactions\/(\d+)$/);
    if (wk) return json(route, TXN[wk[1]] || []);
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (url.includes('/players/nfl/trending')) return json(route, []);
    if (url.includes('/players/nfl')) return json(route, PLAYERS_BLOB);
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', season: '2025', previous_league_id: null });
    if (url.endsWith('/state/nfl')) return json(route, { week: 4, season: '2025', season_type: 'regular' });
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ok: false }));
}

test('the Wire shows The Ticker: waivers and trades, newest first', async ({ page }) => {
  const errors = trackErrors(page);
  await mockWire(page);
  await page.goto('./players');

  const ticker = page.locator('.ticker');
  await expect(ticker.getByText('The Ticker')).toBeVisible({ timeout: 10_000 });

  const moves = ticker.locator('.move');
  await expect(moves.first()).toBeVisible();

  // Newest first: the trade (created 2000) leads the waiver (1000).
  await expect(moves.first().locator('.mtype')).toContainText('TRADE');
  await expect(moves.first()).toContainText('Sleeper TE');

  // The waiver row carries the bid and the add/drop, attributed to the manager.
  const waiver = ticker.locator('.move', { hasText: 'WAIVER' });
  await expect(waiver).toContainText('$37');
  await expect(waiver).toContainText('＋ Star RB');
  await expect(waiver).toContainText('－ Bust WR');
  await expect(waiver.getByText('Buckle Up!').first()).toBeVisible();

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: The Ticker fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockWire(page);
  await page.goto('./players');
  await expect(page.locator('.ticker .move').first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
