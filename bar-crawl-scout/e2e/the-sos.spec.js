// STRENGTH OF SCHEDULE — the per-team SOS chip on Power Rankings.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
  { user_id: '3', display_name: 'WinzTheBrah' },
  { user_id: '4', display_name: 'JohnnyDuff' },
];
// Season ppg: WinzTheBrah 130, JohnnyDuff 120, joshleota 100, jduddy9 80.
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: { wins: 1, losses: 1, fpts: 200 } },
  { roster_id: 2, owner_id: '2', settings: { wins: 0, losses: 2, fpts: 160 } },
  { roster_id: 3, owner_id: '3', settings: { wins: 2, losses: 0, fpts: 260 } },
  { roster_id: 4, owner_id: '4', settings: { wins: 1, losses: 1, fpts: 240 } },
];
// Both weeks: joshleota(1) plays WinzTheBrah(3); jduddy9(2) plays JohnnyDuff(4).
// So joshleota faces the 130-ppg beast twice -> toughest slate.
const WK = [
  { roster_id: 1, matchup_id: 1, points: 95 }, { roster_id: 3, matchup_id: 1, points: 128 },
  { roster_id: 2, matchup_id: 2, points: 70 }, { roster_id: 4, matchup_id: 2, points: 118 },
];

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockLeague(page) {
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    if (url.match(/\/matchups\/\d+$/)) return json(route, WK);
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', name: 'Bar Crawl', season: '2025', previous_league_id: null });
    if (url.endsWith('/state/nfl')) return json(route, { week: 3, season: '2025', season_type: 'regular' });
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ok: false }));
}

test('Power Rankings tags each team with its strength of schedule', async ({ page }) => {
  const errors = trackErrors(page);
  await mockLeague(page);
  await page.goto('./power');

  // joshleota faced the 130-ppg team twice -> SOS #1, opp 130.
  const tough = page.locator('.prow', { hasText: 'Buckle Up!' });
  await expect(tough.locator('.sos')).toContainText('SOS #1');
  await expect(tough.locator('.sos')).toContainText('opp 130');
  await expect(tough.locator('.sos')).toHaveClass(/hard/);

  // jduddy9 faced the 120-ppg team twice, still tough but not #1.
  const soft = page.locator('.prow', { hasText: 'Nice like Rice' });
  await expect(soft.locator('.sos')).toContainText('opp 120');

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: Power Rankings with SOS fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockLeague(page);
  await page.goto('./power');
  await expect(page.locator('.sos').first()).toBeVisible();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
