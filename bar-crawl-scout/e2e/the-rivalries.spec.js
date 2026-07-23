// RIVALRIES — the head-to-head ledger on a manager dossier.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
  { user_id: '3', display_name: 'WinzTheBrah' },
  { user_id: '4', display_name: 'JohnnyDuff' },
];
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: { wins: 2, losses: 1, fpts: 305 } },
  { roster_id: 2, owner_id: '2', settings: { wins: 1, losses: 2, fpts: 295 } },
  { roster_id: 3, owner_id: '3', settings: { wins: 2, losses: 1, fpts: 320 } },
  { roster_id: 4, owner_id: '4', settings: { wins: 1, losses: 2, fpts: 300 } },
];
// joshleota(1) plays jduddy9(2) twice and WinzTheBrah(3) once.
const WEEKS = {
  1: [{ roster_id: 1, matchup_id: 1, points: 110 }, { roster_id: 2, matchup_id: 1, points: 100 }, { roster_id: 3, matchup_id: 2, points: 90 }, { roster_id: 4, matchup_id: 2, points: 85 }],
  2: [{ roster_id: 1, matchup_id: 1, points: 90 }, { roster_id: 3, matchup_id: 1, points: 120 }, { roster_id: 2, matchup_id: 2, points: 88 }, { roster_id: 4, matchup_id: 2, points: 95 }],
  3: [{ roster_id: 1, matchup_id: 1, points: 105 }, { roster_id: 2, matchup_id: 1, points: 95 }, { roster_id: 3, matchup_id: 2, points: 100 }, { roster_id: 4, matchup_id: 2, points: 99 }],
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

test('a dossier lists head-to-head rivalries, most-played first', async ({ page }) => {
  const errors = trackErrors(page);
  await mockSeason(page);
  await page.goto('./managers/joshleota');

  await expect(page.getByText(/Rivalries/i)).toBeVisible();
  const rows = page.locator('.riv');
  await expect(rows.first()).toBeVisible();

  // Most-played rival first: jduddy9 (Nice like Rice), 2-0, +20 differential, last result W.
  const first = rows.first();
  await expect(first.locator('.rnm')).toHaveText('Nice like Rice');
  await expect(first.locator('.rrec')).toHaveText('2-0');
  await expect(first.locator('.rdiff')).toHaveText('+20');
  await expect(first.locator('.rres')).toHaveText('W');

  // The one-off rival also appears.
  await expect(page.locator('.riv', { hasText: 'Jet2 Hall-iday' })).toBeVisible();

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: the rivalries ledger fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockSeason(page);
  await page.goto('./managers/joshleota');
  await expect(page.locator('.riv').first()).toBeVisible();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
