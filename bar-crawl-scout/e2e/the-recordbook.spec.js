// THE RECORD BOOK — season extremes strip on The Table.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
  { user_id: '3', display_name: 'WinzTheBrah' },
  { user_id: '4', display_name: 'JohnnyDuff' },
];
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: { wins: 2, losses: 0, fpts: 270 } },
  { roster_id: 2, owner_id: '2', settings: { wins: 0, losses: 2, fpts: 160 } },
  { roster_id: 3, owner_id: '3', settings: { wins: 1, losses: 1, fpts: 219 } },
  { roster_id: 4, owner_id: '4', settings: { wins: 1, losses: 1, fpts: 209 } },
];
const WEEKS = {
  // Wk1: Buckle Up! 150 crushes Nice like Rice 70 (blowout 80); Jet2 101 edges Go Shough 99 (nail-biter 2)
  1: [{ roster_id: 1, matchup_id: 1, points: 150 }, { roster_id: 2, matchup_id: 1, points: 70 }, { roster_id: 3, matchup_id: 2, points: 101 }, { roster_id: 4, matchup_id: 2, points: 99 }],
  2: [{ roster_id: 1, matchup_id: 1, points: 120 }, { roster_id: 3, matchup_id: 1, points: 118 }, { roster_id: 2, matchup_id: 2, points: 90 }, { roster_id: 4, matchup_id: 2, points: 110 }],
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

test('The Table shows the season Record Book with the right extremes', async ({ page }) => {
  const errors = trackErrors(page);
  await mockLeague(page);
  await page.goto('./standings');

  await expect(page.getByText('The Record Book')).toBeVisible();
  const strip = page.locator('.recbook');
  await expect(strip).toBeVisible();

  const highest = strip.locator('.rec', { hasText: 'Highest week' });
  await expect(highest.locator('b')).toHaveText('150');
  await expect(highest).toContainText('Buckle Up!');

  const blowout = strip.locator('.rec', { hasText: 'Biggest blowout' });
  await expect(blowout.locator('b')).toHaveText('80');
  await expect(blowout).toContainText('Buckle Up! def Nice like Rice');

  const nail = strip.locator('.rec', { hasText: 'Closest game' });
  await expect(nail.locator('b')).toHaveText('2');

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: the Record Book fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockLeague(page);
  await page.goto('./standings');
  await expect(page.locator('.recbook')).toBeVisible();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
