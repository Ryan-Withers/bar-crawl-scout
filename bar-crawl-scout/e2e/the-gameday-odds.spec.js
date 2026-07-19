// GAMEDAY — the pregame line derived from season points-per-game.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
  { user_id: '3', display_name: 'WinzTheBrah' },
  { user_id: '4', display_name: 'JohnnyDuff' },
];
// Season records -> ppg: r1 120, r2 90, r3 110, r4 105.
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: { wins: 3, losses: 0, fpts: 360 } },
  { roster_id: 2, owner_id: '2', settings: { wins: 0, losses: 3, fpts: 270 } },
  { roster_id: 3, owner_id: '3', settings: { wins: 2, losses: 1, fpts: 330 } },
  { roster_id: 4, owner_id: '4', settings: { wins: 1, losses: 2, fpts: 315 } },
];
// This week's live pairings (points are the in-game scoreboard).
const WK = [
  { roster_id: 1, matchup_id: 1, points: 70.2 }, { roster_id: 2, matchup_id: 1, points: 61.0 },
  { roster_id: 3, matchup_id: 2, points: 55.5 }, { roster_id: 4, matchup_id: 2, points: 58.1 },
];

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockWeek(page) {
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    if (url.endsWith('/state/nfl')) return json(route, { week: 3, season: '2025', season_type: 'regular' });
    if (url.match(/\/matchups\/\d+$/)) return json(route, WK);
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', name: 'Bar Crawl', season: '2025', previous_league_id: null });
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ok: false }));
}

test('Gameday prices each matchup: favourite, spread, win% and decimal odds', async ({ page }) => {
  const errors = trackErrors(page);
  await mockWeek(page);
  await page.goto('./matchups');

  const lines = page.locator('.game .line');
  await expect(lines.first()).toBeVisible();
  await expect(lines).toHaveCount(2);

  // The strongest team (Buckle Up!, 120 ppg) is the favourite in its game by 30.
  const strong = page.locator('.game', { hasText: 'Buckle Up!' });
  await expect(strong.locator('.line .fav')).toContainText('Buckle Up!');
  await expect(strong.locator('.line .fav')).toContainText('−30');
  // A win% over half and a two-price moneyline.
  await expect(strong.locator('.line .prob')).toHaveText(/\d+%/);
  await expect(strong.locator('.line .ml')).toContainText(/\$\d+\.\d\d · dog \$\d+\.\d\d/);

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: the Gameday slate with odds fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockWeek(page);
  await page.goto('./matchups');
  await expect(page.locator('.game .line').first()).toBeVisible();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
