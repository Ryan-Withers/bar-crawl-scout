// THE LUCK INDEX — all-play expected wins on The Table.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
  { user_id: '3', display_name: 'WinzTheBrah' },
  { user_id: '4', display_name: 'JohnnyDuff' },
];
// Records give the ACTUAL wins the luck delta is measured against.
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: { wins: 2, losses: 0, fpts: 190 } },
  { roster_id: 2, owner_id: '2', settings: { wins: 1, losses: 1, fpts: 190 } },
  { roster_id: 3, owner_id: '3', settings: { wins: 1, losses: 1, fpts: 190 } },
  { roster_id: 4, owner_id: '4', settings: { wins: 0, losses: 2, fpts: 190 } },
];
// Two played weeks; scores flip so the all-play field is non-trivial.
const WEEKS = {
  1: [{ roster_id: 1, matchup_id: 1, points: 100 }, { roster_id: 2, matchup_id: 1, points: 90 }, { roster_id: 3, matchup_id: 2, points: 80 }, { roster_id: 4, matchup_id: 2, points: 70 }],
  2: [{ roster_id: 1, matchup_id: 1, points: 90 }, { roster_id: 2, matchup_id: 1, points: 100 }, { roster_id: 3, matchup_id: 2, points: 110 }, { roster_id: 4, matchup_id: 2, points: 120 }],
};

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockLeague(page) {
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const wk = url.match(/\/matchups\/(\d+)$/);
    if (wk) return json(route, WEEKS[wk[1]] || []);
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', name: 'Bar Crawl', season: '2025', previous_league_id: null });
    if (url.endsWith('/state/nfl')) return json(route, { week: 3, season: '2025', season_type: 'regular' });
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ok: false }));
}

test('The Table shows the Luck Index with expected wins and a luck delta', async ({ page }) => {
  const errors = trackErrors(page);
  await mockLeague(page);
  await page.goto('./standings');

  const luck = page.locator('.ledger.luck');
  await expect(page.getByText('The Luck Index')).toBeVisible();
  await expect(luck).toBeVisible();

  // Every team appears with an xW and a signed luck chip.
  const rows = luck.locator('.lrow-luck');
  await expect(rows).toHaveCount(4);
  await expect(luck.locator('.luckchip').first()).toHaveText(/[+-]?\d+\.\d/);
  // Luckiest first: the top row's chip is >= the bottom row's.
  const first = parseFloat((await rows.first().locator('.luckchip').innerText()).replace('+', ''));
  const last = parseFloat((await rows.last().locator('.luckchip').innerText()).replace('+', ''));
  expect(first).toBeGreaterThanOrEqual(last);

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: the Luck Index fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockLeague(page);
  await page.goto('./standings');
  await expect(page.locator('.ledger.luck')).toBeVisible();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
