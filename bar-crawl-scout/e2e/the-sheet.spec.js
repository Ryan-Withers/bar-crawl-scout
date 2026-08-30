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

async function mockSheet(page, { proj = PROJ, picks = null } = {}) {
  await mockSleeper(page);
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.endsWith('/state/nfl')) return json({ week: 1, season: '2026', season_type: 'regular' });
    if (/\/league\/\w+$/.test(url)) return json({ league_id: '1', season: '2026', draft_id: 'd1', scoring_settings: SCORING, roster_positions: ROSTER_POSITIONS, previous_league_id: null });
    if (url.endsWith('/users')) return json([{ user_id: '1', display_name: 'witherssssss' }, { user_id: '2', display_name: 'joshleota' }]);
    // Roster 1 holds two men but KEEPS only one. In this league that is the whole
    // point: everyone keeps three and redrafts the rest, so being on a roster is
    // not being off the board.
    if (url.endsWith('/rosters')) return json([
      { roster_id: 1, owner_id: '1', players: ['p1', 'p2'], keepers: ['p2'] },
      { roster_id: 2, owner_id: '2', players: [], keepers: [] },
    ]);
    if (/\/projections\/nfl\/regular\/\d+$/.test(url)) return json(proj);
    if (/\/stats\/nfl\/regular\/\d+$/.test(url)) return json({});
    if (url.includes('/players/nfl')) return json(PLAYERS_BLOB);
    // The live draft feed. Null means "no draft yet", which is the state the
    // board sits in for fifty-one weeks of the year.
    if (url.endsWith('/drafts')) return json(picks ? [{ draft_id: 'd1', season: '2026' }] : []);
    if (url.endsWith('/draft/d1/picks')) return json(picks || []);
    return json([]);
  });
}

// The four explainer strips are collapsed by default now — the board is what
// you open the page for — so anything asserting on them has to open them first.
const openNotes = async (page) => {
  const btn = page.getByTestId('sheet-explain');
  await expect(btn).toBeVisible();
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
};

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

  // #, move, name, pos, team, G, they-see, really, +pts, edge, ppg, 1D, vorp, …
  const SLEEPER = 6; const ACTUAL = 7; const ADP = 8; const ADP_HALF = 9; const ADP_PPR = 10;
  const FP = 11; const VORP = 12; const VALUE = 13; const GAIN = 14; const MARKET = 15; const OURS = 16;

  // Identical yards and scores, so the scoring the MARKET prices them on cannot
  // separate them at all — the same number for both, because a first down is
  // worth nothing on a stock board.
  await expect(cell(page, 'Chain Mover', MARKET)).toHaveText(await cell(page, 'Big Play', MARKET).innerText());
  // ...but our league's does, by exactly the first-down difference: the chain
  // mover has 51 more at half a point, which is 25.5 across the season and 1.5
  // a game. (The 1D column that used to show this is gone; the difference it
  // was pointing at is still the whole reason the two men are not equal.)
  const chains = Number(await cell(page, 'Chain Mover', OURS).innerText());
  const boom = Number(await cell(page, 'Big Play', OURS).innerText());
  expect(chains - boom).toBeCloseTo(1.5, 2);
  const chainsSeason = Number(await cell(page, 'Chain Mover', SLEEPER).innerText());
  const boomSeason = Number(await cell(page, 'Big Play', SLEEPER).innerText());
  expect(chainsSeason - boomSeason).toBeCloseTo(25.5, 1);

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
  await openNotes(page);
  await expect(page.getByTestId('sheet')).toContainText('IDP_FLEX');
  await expect(page.getByTestId('sheet')).toContainText("isn't modelled");
});

test('the unmodelled IDP_FLEX sets no replacement level of its own', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  // By testid, not by text: the lineup strip also says 'no replacement level'.
  await openNotes(page);
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
  await openNotes(page);
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
  await openNotes(page);
  const missing = page.getByTestId('sheet-missing');
  await expect(missing).toBeVisible();
  await expect(missing).toContainText('rec');
  await expect(missing).toContainText("missing from Sleeper's number too");
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

test('your order counts the men you MOVED, not the whole board', async ({ page }) => {
  // It read "my list (3045)" after one nudge, because seeding the order needs
  // every id to keep a move stable. That number is an implementation detail and
  // it looked like a list you had built.
  await mockSheet(page);
  await page.goto('./sheet');
  const rows = page.locator('[data-testid="sheet-table"] tbody tr');
  await expect(rows).toHaveCount(Object.keys(PROJ).length - 1);
  const idAt = async (i) => (await rows.nth(i).locator('[data-testid^="up-"]').getAttribute('data-testid')).slice(3);

  await expect(page.getByTestId('sheet-mine')).toBeDisabled();
  await page.getByTestId('up-' + (await idAt(1))).click();
  await expect(page.getByTestId('sheet-mine')).toContainText('(1)');
  await page.getByTestId('up-' + (await idAt(3))).click();
  await expect(page.getByTestId('sheet-mine')).toContainText('(2)');
});

test('sorting a column leaves your order rather than being ignored by it', async ({ page }) => {
  // THE ONE THAT MATTERED. Your order was applied OVER the top of whatever
  // column you had sorted by, so a single accidental nudge froze the board and
  // every sort after it silently did nothing — while the heading still drew an
  // arrow claiming otherwise.
  await mockSheet(page);
  await page.goto('./sheet');
  const rows = page.locator('[data-testid="sheet-table"] tbody tr');
  await expect(rows).toHaveCount(Object.keys(PROJ).length - 1);
  const idAt = async (i) => (await rows.nth(i).locator('[data-testid^="up-"]').getAttribute('data-testid')).slice(3);

  const heads = page.locator('[data-testid="sheet-table"] thead th');
  const labels = (await heads.allTextContents()).map((t) => t.replace(/[▼▲]/g, '').trim());
  const sleeperCol = labels.indexOf('Sleeper');
  const ptsIn = async () => (await page.locator(
    `[data-testid="sheet-table"] tbody tr td:nth-child(${sleeperCol + 1})`,
  ).allTextContents()).map(Number);

  await heads.nth(sleeperCol).click();
  const sortedPts = await ptsIn();
  expect([...sortedPts].sort((a, b) => b - a)).toEqual(sortedPts);

  // Nudge somebody. The board switches to your order and SAYS it has.
  await page.getByTestId('up-' + (await idAt(2))).click();
  await expect(page.getByTestId('sheet-minenote')).toBeVisible();
  await expect(heads.nth(sleeperCol)).not.toContainText('▼');    // no arrow it cannot honour

  // Sort again: the click is obeyed, your order steps aside, and it says so.
  // (Same column twice flips the direction, which is the ordinary behaviour —
  // the point is that the click DOES something now.)
  await heads.nth(sleeperCol).click();
  await expect(page.getByTestId('sheet-minenote')).toHaveCount(0);
  await expect(heads.nth(sleeperCol)).toContainText('▲');
  const after = await ptsIn();
  expect([...after].sort((a, b) => a - b)).toEqual(after);

  // ...and the list is only set aside, not thrown away.
  await expect(page.getByTestId('sheet-mine')).toContainText('(1)');
  await page.getByTestId('sheet-mine').click();
  await expect(page.getByTestId('sheet-minenote')).toBeVisible();
});

test('every filter actually filters', async ({ page }) => {
  // Audited one at a time after the board looked like none of them worked. They
  // all did — it was the frozen order making every subset come out jumbled — but
  // "I checked once" is not a thing a test suite can remember.
  await mockSheet(page);
  await page.goto('./sheet');
  const rows = page.locator('[data-testid="sheet-table"] tbody tr');
  const all = Object.keys(PROJ).length - 1;
  await expect(rows).toHaveCount(all);

  const posOf = async () => new Set((await page.locator(
    '[data-testid="sheet-table"] tbody tr td:nth-child(4)',
  ).allTextContents()).map((t) => t.trim()));

  // Every man shown is of that position — and a tab with nobody in this feed
  // (there is no tight end in it) shows nobody rather than everybody.
  for (const [tab, want] of [['qb', 'QB'], ['rb', 'RB'], ['wr', 'WR'], ['te', 'TE']]) {
    await page.getByTestId('sheet-pos-' + tab).click();
    for (const p of await posOf()) expect(p, tab).toBe(want);
  }
  await page.getByTestId('sheet-pos-te').click();
  await expect(rows).toHaveCount(0);
  await page.getByTestId('sheet-pos-flex').click();
  for (const p of await posOf()) expect(['RB', 'WR', 'TE']).toContain(p);
  await page.getByTestId('sheet-pos-all').click();
  await expect(rows).toHaveCount(all);

  // Search matches a name, and a team code exactly.
  await page.getByTestId('sheet-search').fill('chain');
  await expect(rows).toHaveCount(1);
  await page.getByTestId('sheet-search').fill('BUF');
  await expect(rows).toHaveCount(1);
  await page.getByTestId('sheet-search').fill('');
  await expect(rows).toHaveCount(all);

  // Part-season men can be dropped, and there is exactly one in this feed.
  const partial = page.locator('label.chk', { hasText: 'hide part-season' });
  await partial.locator('input').check();
  await expect(rows).toHaveCount(all - 1);
  await partial.locator('input').uncheck();
  await expect(rows).toHaveCount(all);
});

test('refresh re-pulls, and the filters narrow the board', async ({ page }) => {
  let pulls = 0;
  await mockSleeper(page);
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.endsWith('/state/nfl')) return json({ week: 1, season: '2026', season_type: 'regular' });
    if (/\/league\/\w+$/.test(url)) return json({ league_id: '1', season: '2026', draft_id: 'd1', scoring_settings: SCORING, roster_positions: ROSTER_POSITIONS, previous_league_id: null });
    if (url.endsWith('/users')) return json([{ user_id: '1', display_name: 'witherssssss' }]);
    if (url.endsWith('/rosters')) return json([{ roster_id: 1, owner_id: '1', players: ['p2'] }]);
    if (/\/projections\/nfl\/regular\/\d+$/.test(url)) { pulls++; return json(PROJ); }
    if (/\/stats\/nfl\/regular\/\d+$/.test(url)) return json({});
    if (url.includes('/players/nfl')) return json(PLAYERS_BLOB);
    if (url.endsWith('/drafts')) return json([]);
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
  await openNotes(page);
  await expect(page.getByTestId('sheet')).toContainText('held out of replacement');
});

test('a rostered man who was NOT kept stays on the board', async ({ page }) => {
  // Everyone keeps three and redrafts the rest, so "rostered" is not "taken".
  // Treating the two as the same hid the best draftable player in the league.
  await mockSheet(page);
  await page.goto('./sheet');
  const table = page.getByTestId('sheet-table');
  await expect(table).toContainText('Chain Mover');       // rostered, not kept
  await expect(table).toContainText('Big Play');          // rostered AND kept

  // The toggle knows the difference, and says so.
  const chk = page.locator('label.chk', { hasText: /hide gone/i });
  await expect(chk).toBeVisible();
  await chk.locator('input').check();
  await expect(table).toContainText('Chain Mover');       // still draftable
  await expect(table).not.toContainText('Big Play');      // genuinely gone
});

test('the kept man is marked as kept, not merely as owned', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  // On the name now that the Status column is gone.
  const nameOf = (who) => page.locator('[data-testid="sheet-table"] tbody tr', { hasText: who }).locator('td.nm');
  await expect(nameOf('Big Play')).toHaveAttribute('title', /^Kept/);
  await expect(nameOf('Chain Mover')).not.toHaveAttribute('title', /^Kept/);
});


// ---------------------------------------------------------------------------
// WHAT THE LEAGUE SEES vs WHAT HE IS REALLY WORTH.
//
// The point of the whole page in three columns. Sleeper publishes its own
// half-PPR season projection and that is the number the other nine managers are
// looking at; ours is the same projected stats scored under our rulebook. The
// board shows both, so the difference is arguable rather than asserted.

test('the three columns are season totals, and the gap between them is the rulebook', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const SLEEPER = 6; const ACTUAL = 7; const MARKET = 15; const G = 5;

  const num = async (name, col) => Number((await cell(page, name, col).innerText()).replace(/[^0-9.-]/g, ''));
  const market = await num('Gunslinger', MARKET);
  const sleeper = await num('Gunslinger', SLEEPER);
  const actual = await num('Gunslinger', ACTUAL);
  const games = await num('Gunslinger', G);

  // A season total, not a rate: 34 passing TDs at six rather than four is +68
  // over a season, and it cannot be that big if the column were per game.
  expect(games).toBe(17);
  expect(market).toBeGreaterThan(200);
  expect(sleeper).toBeGreaterThan(market);
  // No prior season in this feed, so nothing to estimate a fumble from and the
  // real projection is their number unchanged.
  expect(actual).toBe(sleeper);
  // 34 TDs x 2 extra, minus 10 interceptions at one extra = +58 over the
  // half-PPR the market prices him on.
  expect(sleeper - market).toBe(58);
});

test('every column explains itself on hover', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();

  const vorp = page.locator('thead th', { hasText: /^VORP/ });
  await vorp.hover();
  const tip = page.locator('.tip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('replacement starter');

  await page.locator('thead th', { hasText: /^Sleeper/ }).hover();
  await expect(tip).toContainText('draft room');

  await page.locator('thead th', { hasText: /^Market/ }).hover();
  await expect(tip).toContainText('half-PPR');

  await page.locator('thead th', { hasText: /^Value/ }).hover();
  await expect(tip).toContainText('UNDERVALUED');
  await page.locator('thead th', { hasText: /^Gain/ }).hover();
  await expect(tip).toContainText('BY HOW MUCH');

  // And it goes away again rather than following you around the page.
  await page.locator('h2, .ttl, header').first().hover();
  await expect(tip).toHaveCount(0);
});

test('hovering a column does not sort it — the explainer is not a click', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const before = await page.locator('[data-testid="sheet-table"] tbody tr').first().innerText();
  await page.locator('thead th').filter({ hasText: /^\s*ADP\s*$/ }).hover();
  await expect(page.locator('.tip')).toBeVisible();
  await expect(page.locator('[data-testid="sheet-table"] tbody tr').first()).toHaveText(before);
});

// ---------------------------------------------------------------------------
// DRAFT NIGHT. Refresh, and the men who have gone strike themselves off.

const PICKS = [
  { player_id: 'p2', round: 12, draft_slot: 3, pick_no: 113, is_keeper: true, roster_id: 1, picked_by: '1' },
  { player_id: 'p1', round: 1, draft_slot: 7, pick_no: 7, roster_id: 2, picked_by: '2' },
];

test('a drafted man is struck off with the pick he went at and who took him', async ({ page }) => {
  await mockSheet(page, { picks: PICKS });
  await page.goto('./sheet');
  const table = page.getByTestId('sheet-table');
  await expect(table).toBeVisible();

  // The Status column is gone — it cost a sixth of the board's width for a fact
  // you need once a pick — so what it said now hangs off the name.
  const nameCell = (who) => page.locator('[data-testid="sheet-table"] tbody tr', { hasText: who }).locator('td.nm');
  const taken = page.locator('[data-testid="sheet-table"] tbody tr', { hasText: 'Chain Mover' });
  await expect(nameCell('Chain Mover')).toHaveAttribute('title', /Drafted 1\.07/);
  await expect(nameCell('Chain Mover')).toHaveAttribute('title', /Buckle Up!/);   // joshleota's team
  await expect(taken).toHaveClass(/owned/);             // still greyed, not hidden

  // A keeper is still a keeper, even though he arrives down the same feed.
  await expect(nameCell('Big Play')).toHaveAttribute('title', /^Kept/);

  // Someone nobody has taken says nothing at all.
  await expect(nameCell('Gunslinger')).toHaveAttribute('title', '');
});

test('the board counts what is gone, and hides it on request', async ({ page }) => {
  await mockSheet(page, { picks: PICKS });
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  await expect(page.getByTestId('sheet-count')).toContainText('1 drafted');

  await page.getByTestId('sheet-hidegone').check();
  const table = page.getByTestId('sheet-table');
  await expect(table).not.toContainText('Chain Mover');   // drafted
  await expect(table).not.toContainText('Big Play');      // kept
  await expect(table).toContainText('Gunslinger');        // still there to take
});

test('before a draft exists the board is simply the board', async ({ page }) => {
  await mockSheet(page);                    // no picks feed at all
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  await expect(page.getByTestId('sheet-count')).not.toContainText('drafted');
  await expect(page.getByTestId('sheet')).toContainText('Chain Mover');
});

test('the live toggle is off until you ask for it', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-live')).not.toBeChecked();
});

test('every column has a header, and every header a column', async ({ page }) => {
  // Caught a real one: adding the second ADP column put a cell in every row and
  // no label above it, so from ADP rightwards every heading named the column to
  // its left — VORP over the ADP figures, Value over VORP. Nothing failed, the
  // board just quietly lied about which number was which.
  await mockSheet(page);
  await page.goto('./sheet');
  const table = page.getByTestId('sheet-table');
  await expect(table).toBeVisible();
  const headers = await table.locator('thead th').count();
  const cells = await table.locator('tbody tr').first().locator('td').count();
  expect(cells).toBe(headers);
});

test('shows the price in your room AND the one the rest of the world quotes', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const labels = await page.locator('[data-testid="sheet-table"] thead th').allTextContents();
  const trimmed = labels.map((t) => t.replace(/[▼▲]/g, '').trim());
  expect(trimmed).toContain('ADP');
  expect(trimmed).toContain('ADP½');
  // Side by side, so the gap between them is readable at a glance.
  expect(trimmed.indexOf('ADP½') - trimmed.indexOf('ADP')).toBe(1);

  await page.locator('thead th').filter({ hasText: /^\s*ADP½/ }).hover();
  await expect(page.locator('.tip')).toContainText('mainstream half-PPR');
});

// ---------------------------------------------------------------------------
// THE BOARD IS THE PAGE. Filters that answer a draft-day question, a star and a
// tag you can put on a man, and four explainer strips folded out of the way.

test('the page opens on the board, with the explanation one tap away', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  // Collapsed to start: the strips are worth reading once, not every visit.
  await expect(page.getByTestId('sheet-replacement')).toHaveCount(0);
  await page.getByTestId('sheet-explain').click();
  await expect(page.getByTestId('sheet-replacement')).toBeVisible();
  // And it is remembered, so it stays how you left it.
  await page.reload();
  await expect(page.getByTestId('sheet-replacement')).toBeVisible();
});

test('one tooltip, not two', async ({ page }) => {
  // The headings carried a native title AND the custom explainer, so hovering
  // printed the same sentence twice, in two boxes, on top of the board.
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const th = page.locator('thead th', { hasText: /^VORP/ });
  await expect(th).not.toHaveAttribute('title', /./);
  await th.hover();
  await expect(page.locator('.tip')).toHaveCount(1);
});

test('FLEX is a filter, because it is a seat', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  await page.getByTestId('sheet-pos-flex').click();
  const posCells = await page.locator('[data-testid="sheet-table"] tbody tr td:nth-child(4)').allTextContents();
  expect(posCells.length).toBeGreaterThan(0);
  for (const p of posCells) expect(['RB', 'WR', 'TE']).toContain(p.trim());
  // The quarterback is a real player and is not eligible for the seat.
  await expect(page.getByTestId('sheet-table')).not.toContainText('Gunslinger');
});

test('rookies filter off Sleeper’s own years of experience', async ({ page }) => {
  // PLAYERS_BLOB gives Half Season years_exp 1 and the rest more, so nobody in
  // this feed is a rookie — the filter has to say so rather than show everyone.
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const before = await page.locator('[data-testid="sheet-table"] tbody tr').count();
  await page.getByTestId('sheet-rookies').click();
  await expect(page.locator('[data-testid="sheet-table"] tbody tr')).toHaveCount(0);
  await page.getByTestId('sheet-rookies').click();
  await expect(page.locator('[data-testid="sheet-table"] tbody tr')).toHaveCount(before);
});

test('star a man, filter to your stars, and they survive a reload', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  await expect(page.getByTestId('sheet-favs')).toBeDisabled();   // nothing starred yet

  await page.getByTestId('fav-p3').click();                      // Gunslinger
  await expect(page.getByTestId('sheet-favs')).toBeEnabled();
  await page.getByTestId('sheet-favs').click();
  const rows = page.locator('[data-testid="sheet-table"] tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Gunslinger');

  await page.reload();
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  await expect(page.getByTestId('sheet-favs')).toBeEnabled();
  await page.getByTestId('fav-p3').click();                      // unstar
  await expect(page.getByTestId('sheet-favs')).toBeDisabled();
});

test('put your own words on a player and filter by them', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();

  await page.getByTestId('tag-p1').click();
  await expect(page.getByTestId('tagbox')).toContainText('Chain Mover');
  await page.getByTestId('tag-input').fill('handcuff');
  await page.getByTestId('tag-input').press('Enter');
  await expect(page.getByTestId('tagbox')).toContainText('handcuff');
  await page.getByRole('button', { name: 'done' }).click();

  // It shows on the row and becomes a filter of its own.
  const row = page.locator('[data-testid="sheet-table"] tbody tr', { hasText: 'Chain Mover' });
  await expect(row).toContainText('handcuff');
  const chip = page.locator('.chip.tagchip', { hasText: 'handcuff' });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.locator('[data-testid="sheet-table"] tbody tr')).toHaveCount(1);
});

test('shows four prices: your room, half PPR, full PPR and the consensus', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const labels = (await page.locator('[data-testid="sheet-table"] thead th').allTextContents())
    .map((t) => t.replace(/[▼▲]/g, '').trim());
  const want = ['ADP', 'ADP½', 'ADP1', 'FP'];
  for (const w of want) expect(labels, w).toContain(w);
  // Adjacent and in that order, so the spread reads left to right.
  const at = want.map((w) => labels.indexOf(w));
  expect(at).toEqual([at[0], at[0] + 1, at[0] + 2, at[0] + 3]);

  await page.locator('thead th').filter({ hasText: /^\s*FP\s*$/ }).hover();
  await expect(page.locator('.tip')).toContainText('ESPN, Yahoo, CBS');
});

test('1D, PosRk and Status are gone', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const labels = (await page.locator('[data-testid="sheet-table"] thead th').allTextContents())
    .map((t) => t.replace(/[▼▲]/g, '').trim());
  for (const gone of ['1D', 'PosRk', 'Status']) expect(labels).not.toContain(gone);
});

test('a price column opens lowest first — 16 is a second-rounder, 200 is nobody', async ({ page }) => {
  // Every points column opens with the biggest at the top, which is right for
  // points and exactly backwards for a price. Opening a price descending put
  // the men nobody drafts on top and made you click twice, every time.
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();

  const heads = page.locator('[data-testid="sheet-table"] thead th');
  const labels = (await heads.allTextContents()).map((t) => t.replace(/[▼▲]/g, '').trim());
  const numbersIn = async (col) => (await page.locator(
    `[data-testid="sheet-table"] tbody tr td:nth-child(${col + 1})`,
  ).allTextContents()).map((t) => Number(t.replace(/[^0-9.]/g, ''))).filter((n) => n > 0);

  for (const label of ['ADP', 'ADP½', 'ADP1', 'FP']) {
    const col = labels.indexOf(label);
    expect(col, `${label} is on the board`).toBeGreaterThan(-1);
    const th = heads.nth(col);
    await th.click();
    await expect(th, `${label} opens ascending`).toContainText('▲');
    const vals = await numbersIn(col);
    if (vals.length > 1) expect([...vals].sort((a, b) => a - b), `${label} ascends`).toEqual(vals);
    // ...and a second click still flips it, so nothing is taken away.
    await th.click();
    await expect(th).toContainText('▼');
  }
});

test('but points columns still open highest first', async ({ page }) => {
  await mockSheet(page);
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-table')).toBeVisible();
  const heads = page.locator('[data-testid="sheet-table"] thead th');
  const labels = (await heads.allTextContents()).map((t) => t.replace(/[▼▲]/g, '').trim());
  for (const label of ['Sleeper', 'Actual', 'VORP', 'Value', 'Gain']) {
    const col = labels.indexOf(label);
    expect(col, `${label} is on the board`).toBeGreaterThan(-1);
    const th = heads.nth(col);
    await th.click();
    await expect(th, `${label} opens descending`).toContainText('▼');
  }
});
