// THE SHEET — the hidden draft board. Proves the thing that matters: a player
// is scored under THIS league's rulebook, not a stock one, and the page says
// so out loud.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

// Our league's real distortions: 6-point passing TDs, half a point per first
// down either way, and fum stacked on fum_lost. The IDP_FLEX is real but
// deliberately unmodelled — a last-round filler — so defenders must not appear.
const SCORING = {
  pass_yd: 0.04, pass_td: 6, pass_int: -2,
  rush_yd: 0.1, rush_td: 6, rush_fd: 0.5,
  rec: 0.5, rec_yd: 0.1, rec_td: 6, rec_fd: 0.5,
  fum: -1, fum_lost: -1,
  idp_tkl: 0.5, idp_sack: 2, idp_int: 2, idp_pass_def: 1,
};
const ROSTER_POSITIONS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'IDP_FLEX', 'BN', 'BN'];

// Two backs with IDENTICAL yards and scores; one moves the chains twice as often.
const PROJ = {
  p1: { gp: 17, rush_yd: 1700, rush_td: 17, rush_fd: 102 },   // Chain Mover
  p2: { gp: 17, rush_yd: 1700, rush_td: 17, rush_fd: 51 },    // Big Play
  p3: { gp: 17, pass_yd: 4250, pass_td: 34, pass_int: 10 },   // Gunslinger
  p4: { gp: 17, rec: 100, rec_yd: 1400, rec_td: 10, rec_fd: 68 },
  p5: { gp: 17, idp_tkl: 130, idp_sack: 8, idp_int: 2, idp_pass_def: 6 },
  p6: { gp: 6, rush_yd: 900, rush_td: 9, rush_fd: 40 },       // part season
};
const PLAYERS_BLOB = {
  p1: { player_id: 'p1', full_name: 'Chain Mover', position: 'RB', team: 'BUF', search_rank: 1, fantasy_positions: ['RB'], years_exp: 3, age: 25 },
  p2: { player_id: 'p2', full_name: 'Big Play', position: 'RB', team: 'MIA', search_rank: 2, fantasy_positions: ['RB'], years_exp: 4, age: 26 },
  p3: { player_id: 'p3', full_name: 'Gunslinger', position: 'QB', team: 'KC', search_rank: 3, fantasy_positions: ['QB'], years_exp: 6, age: 29 },
  p4: { player_id: 'p4', full_name: 'Route Tech', position: 'WR', team: 'CIN', search_rank: 4, fantasy_positions: ['WR'], years_exp: 2, age: 24 },
  p5: { player_id: 'p5', full_name: 'Head Hunter', position: 'LB', team: 'SF', search_rank: 5, fantasy_positions: ['LB'], years_exp: 5, age: 27 },
  p6: { player_id: 'p6', full_name: 'Half Season', position: 'RB', team: 'NYJ', search_rank: 6, fantasy_positions: ['RB'], years_exp: 1, age: 23 },
};

async function mockSheet(page, { proj = PROJ } = {}) {
  await mockSleeper(page);
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.endsWith('/state/nfl')) return json({ week: 1, season: '2026', season_type: 'regular' });
    if (/\/league\/\w+$/.test(url)) return json({ league_id: '1', season: '2026', scoring_settings: SCORING, roster_positions: ROSTER_POSITIONS, previous_league_id: null });
    if (url.endsWith('/users')) return json([{ user_id: '1', display_name: 'witherssssss' }, { user_id: '2', display_name: 'joshleota' }]);
    if (url.endsWith('/rosters')) return json([{ roster_id: 1, owner_id: '1', players: ['p2'] }, { roster_id: 2, owner_id: '2', players: [] }]);
    if (/\/projections\/nfl\/regular\/\d+$/.test(url)) return json(proj);
    if (/\/stats\/nfl\/regular\/\d+$/.test(url)) return json({});
    if (url.includes('/players/nfl')) return json(PLAYERS_BLOB);
    return json([]);
  });
}

const cell = (page, name, col) =>
  page.locator('[data-testid="sheet-table"] tbody tr', { hasText: name }).locator('td').nth(col);

test('the sheet exists at a URL nothing links to', async ({ page }) => {
  await mockSheet(page);
  // Nothing in the shell points at it.
  await page.goto('./');
  await expect(page.getByRole('link', { name: /the sheet/i })).toHaveCount(0);
  await expect(page.locator('a[href$="/sheet"]')).toHaveCount(0);
  // But it's there if you know.
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet')).toBeVisible();
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  // And it owns the whole screen — no sidebar, no tab bar.
  await expect(page.getByTestId('sidebar')).toHaveCount(0);
  await expect(page.getByTestId('tabbar')).toHaveCount(0);
});

test('it prices the first-down rules a stock ranking cannot see', async ({ page }) => {
  const errors = trackErrors(page);
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();

  // Columns: #, move, Player, Pos, Tm, Age, Exp, G, PPG ours, Stock, 1D pts...
  const OURS = 8; const STOCK = 9; const FD = 10;

  // Identical yards and scores, so a stock board cannot separate them...
  await expect(cell(page, 'Chain Mover', STOCK)).toHaveText(await cell(page, 'Big Play', STOCK).innerText());
  // ...but ours can, by exactly the first-down difference: 51 * 0.5 / 17 = 1.5
  const chains = Number(await cell(page, 'Chain Mover', OURS).innerText());
  const boom = Number(await cell(page, 'Big Play', OURS).innerText());
  expect(chains - boom).toBeCloseTo(1.5, 2);
  await expect(cell(page, 'Chain Mover', FD)).toHaveText('3.00');
  await expect(cell(page, 'Big Play', FD)).toHaveText('1.50');

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('defenders are off the board entirely, and it says why', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();

  // Head Hunter is a projected LB in the feed and must not reach the board.
  await expect(page.locator('[data-testid="sheet-table"] tbody tr', { hasText: 'Head Hunter' })).toHaveCount(0);
  await expect(page.getByTestId('sheet')).not.toContainText('Head Hunter');
  // No IDP filter tab either.
  await expect(page.getByTestId('sheet-pos-idp')).toHaveCount(0);

  // The lineup is still reported honestly, with the exclusion stated once.
  await expect(page.getByTestId('sheet')).toContainText('IDP_FLEX');
  await expect(page.getByTestId('sheet')).toContainText("isn't modelled");
});

test('the unmodelled IDP_FLEX sets no replacement level of its own', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  // By testid, not by text: the lineup strip also says 'no replacement level'.
  const repl = page.getByTestId('sheet-replacement');
  await expect(repl).toContainText('QB');          // offence is levelled
  await expect(repl).not.toContainText('LB');      // the LB in the feed sets nothing
  // The IDP_FLEX is dropped before the fill, so it can never report its own
  // (necessarily empty) pool as having run dry. Thin offence still can, and
  // does here — that warning must be about offence only.
  const strip = await repl.innerText();
  if (/ran dry/.test(strip)) {
    expect(strip).not.toMatch(/ran dry[^\n]*\b(LB|DL|DB|IDP)/);
  }
});

test('the coverage panel judges only the rules this board actually scores', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  // Every IDP rule is scored by the league and unprojected on this board, but
  // they're out of scope by choice — reporting them would bury a real gap under
  // ten lines of noise. (fum IS reported: nobody in this feed has one projected.)
  const missing = page.getByTestId('sheet-missing');
  await expect(missing).toBeVisible();
  await expect(missing).not.toContainText('idp_');
  await expect(missing).toContainText('fum');
});

test('a genuinely unbacked offensive rule IS called out', async ({ page }) => {
  // Nobody in the feed has a 2-point conversion projected.
  const thin = { p1: { gp: 17, rush_yd: 1700, rush_td: 17, rush_fd: 102 } };
  await mockSheet(page, { proj: thin });
  await page.goto('./sheet');
  const missing = page.getByTestId('sheet-missing');
  await expect(missing).toBeVisible();
  await expect(missing).toContainText('rec');
  await expect(missing).toContainText('missing from every row');
  await expect(missing).not.toContainText('idp_');
});

test('you can reorder, keep your list, and put the standard board back', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  const rows = page.locator('[data-testid="sheet-table"] tbody tr');
  const OFFENCE = Object.keys(PROJ).length - 1;   // the LB is filtered off the board
  await expect(rows).toHaveCount(OFFENCE);   // settled board first

  // Read the id off the row itself — never map a name back to an id by hand.
  const idAt = async (i) => (await rows.nth(i).locator('[data-testid^="up-"]').getAttribute('data-testid')).slice(3);
  const topBefore = await idAt(0);
  const second = await idAt(1);

  // Move the second man to the top.
  await page.getByTestId('up-' + second).click();
  await expect.poll(() => idAt(0)).toBe(second);
  await expect(page.getByTestId('sheet-mine')).toHaveClass(/on/);

  // It survives a reload — it's your list, not the run's.
  await page.reload();
  await expect(rows).toHaveCount(OFFENCE);
  await expect.poll(() => idAt(0)).toBe(second);

  // And one button hands the standard board back.
  await page.getByTestId('sheet-standard').click();
  await expect.poll(() => idAt(0)).toBe(topBefore);
});

test('refresh re-pulls, and the filters narrow the board', async ({ page }) => {
  let pulls = 0;
  await mockSleeper(page);
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.endsWith('/state/nfl')) return json({ week: 1, season: '2026', season_type: 'regular' });
    if (/\/league\/\w+$/.test(url)) return json({ league_id: '1', season: '2026', scoring_settings: SCORING, roster_positions: ROSTER_POSITIONS, previous_league_id: null });
    if (url.endsWith('/users')) return json([{ user_id: '1', display_name: 'witherssssss' }]);
    if (url.endsWith('/rosters')) return json([{ roster_id: 1, owner_id: '1', players: ['p2'] }]);
    if (/\/projections\/nfl\/regular\/\d+$/.test(url)) { pulls++; return json(PROJ); }
    if (/\/stats\/nfl\/regular\/\d+$/.test(url)) return json({});
    if (url.includes('/players/nfl')) return json(PLAYERS_BLOB);
    return json([]);
  });
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const first = pulls;
  expect(first).toBeGreaterThan(0);

  await page.getByTestId('sheet-refresh').click();
  await expect.poll(() => pulls).toBeGreaterThan(first);

  // Position filter narrows to one group.
  await page.getByTestId('sheet-pos-qb').click();
  const rows = page.locator('[data-testid="sheet-table"] tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Gunslinger');

  // Search does too.
  await page.getByTestId('sheet-pos-all').click();
  await page.getByTestId('sheet-search').fill('chain');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Chain Mover');
});

test('a part-season projection is flagged and kept out of replacement', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.locator('[data-testid="sheet-table"] tbody tr', { hasText: 'Half Season' })).toContainText('6G');
  await expect(page.getByTestId('sheet')).toContainText('held out of replacement');
});
