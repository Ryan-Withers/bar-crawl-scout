// POSITIONAL EDGES — the "Where it's won" breakdown on This Week.
import { test, expect } from '@playwright/test';
import { trackErrors } from './support/mock-sleeper.js';

const p = (n, pos, t) => ({ n, p: pos, t, s: true });
// Rich rosters of real board players so the optimal lineup fills several slots.
const WORKER_ROSTERS = {
  Ryan: { count: 4, players: [p('Joe Burrow', 'QB', 'CIN'), p('Bijan Robinson', 'RB', 'ATL'), p('Ja’Marr Chase', 'WR', 'CIN'), p('Brock Bowers', 'TE', 'LV')] },
  joshleota: { count: 4, players: [p('Josh Allen', 'QB', 'BUF'), p('Jahmyr Gibbs', 'RB', 'DET'), p('Justin Jefferson', 'WR', 'MIN'), p('Trey McBride', 'TE', 'ARI')] },
};

const USERS = [{ user_id: '1', display_name: 'witherssssss' }, { user_id: '2', display_name: 'joshleota' }];
const ROSTERS = [{ roster_id: 1, owner_id: '1', settings: { wins: 2, losses: 1, fpts: 340 } }, { roster_id: 2, owner_id: '2', settings: { wins: 1, losses: 2, fpts: 300 } }];
const WK = [{ roster_id: 1, matchup_id: 1, points: 0 }, { roster_id: 2, matchup_id: 1, points: 0 }];

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockMatchup(page) {
  await page.addInitScript((rosters) => {
    localStorage.setItem('bcs_bettor', JSON.stringify('Ryan'));
    localStorage.setItem('hq_rosters_v2', JSON.stringify({ t: new Date(0).toISOString(), byHandle: rosters }));
  }, WORKER_ROSTERS);

  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    if (url.endsWith('/state/nfl')) return json(route, { week: 3, season: '2025', season_type: 'regular' });
    if (url.match(/\/matchups\/\d+$/)) return json(route, WK);
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', name: 'Bar Crawl', season: '2025', previous_league_id: null, roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN'], scoring_settings: { pass_yd: 0.04, pass_td: 6, rush_yd: 0.1, rush_td: 6, rec: 0.5, rec_yd: 0.1, rec_td: 6 } });
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ts: new Date(0).toISOString(), rosters: WORKER_ROSTERS }));
}

test('This Week breaks the matchup down by position', async ({ page }) => {
  const errors = trackErrors(page);
  await mockMatchup(page);
  await page.goto('./matchup');

  const edges = page.locator('.edges');
  await expect(edges).toBeVisible();
  await expect(edges.getByText(/Where it's won/i)).toBeVisible();

  // A row per contested slot, each with a signed delta.
  const rows = edges.locator('.erow');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(3);
  await expect(edges.locator('.epos').first()).toHaveText('QB');
  await expect(edges.locator('.edelta').first()).toHaveText(/^[+-]?\d/);

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('phone: the positional breakdown fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockMatchup(page);
  await page.goto('./matchup');
  await expect(page.locator('.edges')).toBeVisible();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
