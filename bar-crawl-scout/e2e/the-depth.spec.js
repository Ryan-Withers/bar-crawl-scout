// ROSTER DEPTH — the positional depth strip on My Team.
import { test, expect } from '@playwright/test';

const pl = (n, p, t, s) => ({ n, p, t, s });
// 1 QB (thin), 3 RB (ok), 4 WR (deep), 1 TE (thin).
const RYAN_ROSTER = [
  pl('Joe Burrow', 'QB', 'CIN', true),
  pl('Bijan Robinson', 'RB', 'ATL', true), pl('Jahmyr Gibbs', 'RB', 'DET', true), pl('Jonathan Taylor', 'RB', 'IND', false),
  pl('Justin Jefferson', 'WR', 'MIN', true), pl('CeeDee Lamb', 'WR', 'DAL', true), pl('Puka Nacua', 'WR', 'LAR', false), pl('Malik Nabers', 'WR', 'NYG', false),
  pl('Brock Bowers', 'TE', 'LV', true),
];
const WORKER_ROSTERS = { Ryan: { count: RYAN_ROSTER.length, players: RYAN_ROSTER } };

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockTeam(page) {
  await page.addInitScript((rosters) => {
    localStorage.setItem('bcs_bettor', JSON.stringify('Ryan'));
    localStorage.setItem('hq_rosters_v2', JSON.stringify({ t: new Date(0).toISOString(), byHandle: rosters }));
  }, WORKER_ROSTERS);
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    if (url.endsWith('/state/nfl')) return json(route, { week: 3, season: '2025', season_type: 'regular' });
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1', season: '2025', previous_league_id: null, roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN'], scoring_settings: {} });
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []);
  });
  await page.route(/workers\.dev/, (route) => json(route, { ts: new Date(0).toISOString(), rosters: WORKER_ROSTERS }));
}

test('My Team shows roster depth with thin/deep tags per position', async ({ page }) => {
  await mockTeam(page);
  await page.goto('./myteam');

  const depth = page.locator('.depth');
  await expect(depth.getByText('Roster depth')).toBeVisible({ timeout: 10_000 });

  const cell = (pos) => depth.locator('.dcell', { has: page.locator('.dpos', { hasText: new RegExp('^' + pos + '$') }) });
  await expect(cell('QB')).toHaveClass(/thin/);
  await expect(cell('WR')).toHaveClass(/deep/);
  await expect(cell('WR')).toContainText('4');
  await expect(cell('TE')).toHaveClass(/thin/);
  // RB has 3 bodies for 2 slots -> OK (neither thin nor deep).
  await expect(cell('RB')).not.toHaveClass(/thin|deep/);
});

test('phone: roster depth fits a 375px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockTeam(page);
  await page.goto('./myteam');
  await expect(page.locator('.depth')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
