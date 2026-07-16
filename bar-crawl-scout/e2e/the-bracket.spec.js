// THE BRACKET — the playoff tree recap on the History wall.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

// A completed single-season bracket: WinzTheBrah (r3) beats joshleota (r1) in the
// final; JohnnyDuff (r5) takes third over jduddy9 (r2).
const USERS = [
  { user_id: '1', display_name: 'joshleota' },
  { user_id: '2', display_name: 'jduddy9' },
  { user_id: '3', display_name: 'WinzTheBrah' },
  { user_id: '5', display_name: 'JohnnyDuff' },
];
const ROSTERS = [
  { roster_id: 1, owner_id: '1', settings: { wins: 9, losses: 4, fpts: 1500 } },
  { roster_id: 2, owner_id: '2', settings: { wins: 5, losses: 8, fpts: 1200 } },
  { roster_id: 3, owner_id: '3', settings: { wins: 8, losses: 5, fpts: 1450 } },
  { roster_id: 5, owner_id: '5', settings: { wins: 7, losses: 6, fpts: 1350 } },
];
const BRACKET = [
  { m: 1, r: 1, w: 1, l: 5, t1: 1, t2: 5 },
  { m: 2, r: 1, w: 3, l: 2, t1: 2, t2: 3 },
  { m: 3, r: 2, w: 3, l: 1, t1: 1, t2: 3, p: 1 }, // Final: WinzTheBrah def joshleota
  { m: 4, r: 2, w: 5, l: 2, t1: 5, t2: 2, p: 3 }, // Third: JohnnyDuff over jduddy9
];

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockBracket(page) {
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    if (url.endsWith('/winners_bracket')) return json(route, BRACKET);
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', name: 'Bar Crawl', season: '2025', previous_league_id: null });
    if (url.endsWith('/state/nfl')) return json(route, { week: 8, season: '2025', season_type: 'regular' });
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ok: false }));
}

test('history shows an expandable playoff bracket for a completed season', async ({ page }) => {
  const errors = trackErrors(page);
  await mockBracket(page);
  await page.goto('./history');

  // The banner resolves the champion from the same bracket.
  await expect(page.getByText(/Jet2 Hall-iday/).first()).toBeVisible();

  const bracket = page.locator('details.bracket').first();
  await expect(bracket).toBeVisible();
  await bracket.locator('summary').click();

  // Round labels render, semis + final.
  await expect(bracket.getByText('Final', { exact: true })).toBeVisible();
  await expect(bracket.getByText('Semifinals', { exact: true })).toBeVisible();

  // The final match shows both finalists, champion bolded as the winner.
  const finalMatch = bracket.locator('.match.title');
  await expect(finalMatch).toContainText('Jet2 Hall-iday');
  await expect(finalMatch).toContainText('Buckle Up!');
  await expect(finalMatch.locator('.team.win')).toHaveText(/Jet2 Hall-iday/);

  // Third-place game is badged.
  await expect(bracket.getByText('3rd', { exact: true })).toBeVisible();

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: the bracket fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockBracket(page);
  await page.goto('./history');
  await page.locator('details.bracket').first().locator('summary').click();
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `history overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
