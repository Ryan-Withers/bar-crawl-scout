// CLUTCH — the one-score record line on the Managers index cards.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
  { user_id: '3', display_name: 'WinzTheBrah' },
  { user_id: '4', display_name: 'JohnnyDuff' },
];
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: { wins: 2, losses: 1, fpts: 296 } },
  { roster_id: 2, owner_id: '2', settings: { wins: 1, losses: 2, fpts: 295 } },
  { roster_id: 3, owner_id: '3', settings: { wins: 2, losses: 1, fpts: 360 } },
  { roster_id: 4, owner_id: '4', settings: { wins: 1, losses: 2, fpts: 284 } },
];
// joshleota(1): close win (5), blowout loss (40), close win (6) -> 2-0 in one-score games.
const WEEKS = {
  1: [{ roster_id: 1, matchup_id: 1, points: 105 }, { roster_id: 2, matchup_id: 1, points: 100 }, { roster_id: 3, matchup_id: 2, points: 120 }, { roster_id: 4, matchup_id: 2, points: 80 }],
  2: [{ roster_id: 1, matchup_id: 1, points: 90 }, { roster_id: 3, matchup_id: 1, points: 130 }, { roster_id: 2, matchup_id: 2, points: 100 }, { roster_id: 4, matchup_id: 2, points: 96 }],
  3: [{ roster_id: 1, matchup_id: 1, points: 101 }, { roster_id: 2, matchup_id: 1, points: 95 }, { roster_id: 3, matchup_id: 2, points: 110 }, { roster_id: 4, matchup_id: 2, points: 108 }],
};

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockSeason(page) {
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const wk = url.match(/\/matchups\/(\d+)$/);
    if (wk) return json(route, WEEKS[wk[1]] || []);
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', name: 'Bar Crawl', season: '2025', previous_league_id: null });
    if (url.endsWith('/state/nfl')) return json(route, { week: 4, season: '2025', season_type: 'regular' });
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ok: false }));
}

test('the Managers index shows a one-score record on each card', async ({ page }) => {
  const errors = trackErrors(page);
  await mockSeason(page);
  await page.goto('./managers');

  const card = page.locator('.folder', { hasText: '@joshleota' });
  const clutch = card.locator('.clutch');
  await expect(clutch).toBeVisible();
  await expect(clutch).toContainText('2-0 in one-score games');
  await expect(clutch).toHaveClass(/hot/); // 100% in close games

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: the Managers cards with clutch fit a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockSeason(page);
  await page.goto('./managers');
  await expect(page.locator('.clutch').first()).toBeVisible();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
