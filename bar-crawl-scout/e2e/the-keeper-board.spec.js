// THE KEEPER BOARD — the real draft, keepers at the bottom, trades and all.
//
// The mock below is a faithful miniature of Ryan's actual league: ten managers,
// fifteen rounds, three keepers each placed on the LAST picks each man still
// owns. One manager (jpdonners) has sold his fifteenth to ImyHunter, which is
// the case that breaks a naive "the live draft is rounds 1 to 12" reading — his
// third keeper rides up into round 12, and ImyHunter keeps a live pick in 13.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

const HANDLES = ['ImyHunter', 'Ryan', 'ShaydenB', 'JShrimp341', 'ATorelli4', 'jpdonners', 'WinzTheBrah', 'joshleota', 'JohnnyDuff', 'jduddy9'];
const TEAMS = 10;
const ROUNDS = 15;

// Three men per manager, named so a keeper is obvious on the board.
const KEEPERS = {};
HANDLES.forEach((h, i) => { KEEPERS[h] = [`${100 + i * 3}`, `${101 + i * 3}`, `${102 + i * 3}`]; });

const PLAYERS = {};
HANDLES.forEach((h, i) => {
  KEEPERS[h].forEach((id, k) => {
    PLAYERS[id] = {
      player_id: id, full_name: `Kept ${h}${k + 1}`, first_name: 'Kept', last_name: `${h}${k + 1}`,
      position: ['RB', 'WR', 'TE'][k], team: 'SEA', search_rank: 10 + i, years_exp: 3, age: 25,
    };
  });
});

const slotAt = (round, idx) => (round % 2 === 0 ? TEAMS - idx : idx + 1);
const rosterOfSlot = (slot) => slot;      // handle i sits in slot i+1, roster i+1

// jpdonners is slot 6 / roster 6; ImyHunter is slot 1 / roster 1.
const TRADED = [{ season: '2026', round: 15, roster_id: 6, owner_id: 1, previous_owner_id: 6 }];

// Sleeper's own placement: each man's keepers land on the highest-numbered picks
// he still owns. With jpdonners' 15th gone, his three sit in rounds 12, 13, 14.
function keeperPicks() {
  const ownerOf = (round, slot) => {
    const orig = rosterOfSlot(slot);
    const t = TRADED.find((x) => x.round === round && x.roster_id === orig);
    return t ? t.owner_id : orig;
  };
  const byRoster = {};
  for (let round = 1; round <= ROUNDS; round++) {
    for (let idx = 0; idx < TEAMS; idx++) {
      const slot = slotAt(round, idx);
      const pickNo = (round - 1) * TEAMS + idx + 1;
      (byRoster[ownerOf(round, slot)] = byRoster[ownerOf(round, slot)] || []).push({ round, slot, pickNo });
    }
  }
  const out = [];
  for (const [rid, picks] of Object.entries(byRoster)) {
    const handle = HANDLES[Number(rid) - 1];
    const mine = picks.sort((a, b) => b.pickNo - a.pickNo).slice(0, 3);
    mine.forEach((p, i) => {
      const id = KEEPERS[handle][i];
      out.push({
        draft_id: 'd1', round: p.round, pick_no: p.pickNo, draft_slot: p.slot,
        roster_id: Number(rid), player_id: id, is_keeper: true,
        metadata: { first_name: 'Kept', last_name: `${handle}${i + 1}`, position: PLAYERS[id].position },
      });
    });
  }
  return out;
}

async function mockLeague(page) {
  await mockSleeper(page);
  const users = HANDLES.map((h, i) => ({ user_id: String(i + 1), display_name: h === 'Ryan' ? 'witherssssss' : h }));
  const rosters = HANDLES.map((h, i) => ({
    roster_id: i + 1, owner_id: String(i + 1),
    players: [...KEEPERS[h]], starters: [], keepers: [...KEEPERS[h]], settings: {},
  }));
  const draft_order = Object.fromEntries(users.map((u, i) => [u.user_id, i + 1]));
  const draft = {
    draft_id: 'd1', season: '2026', type: 'snake', status: 'pre_draft', draft_order,
    settings: { rounds: ROUNDS, teams: TEAMS },
  };
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  // Registered AFTER mockSleeper's catch-all, so these win (newest route first).
  await page.route(/api\.sleeper\.app.*\/users$/, (r) => json(r, users));
  await page.route(/api\.sleeper\.app.*\/rosters$/, (r) => json(r, rosters));
  await page.route(/api\.sleeper\.app.*\/drafts$/, (r) => json(r, [draft]));
  await page.route(/api\.sleeper\.app.*\/traded_picks$/, (r) => json(r, TRADED));
  await page.route(/api\.sleeper\.app.*\/draft\/d1\/picks$/, (r) => json(r, keeperPicks()));
  await page.route(/api\.sleeper\.app.*\/players\/nfl$/, (r) => json(r, PLAYERS));
  await page.route(/api\.sleeper\.app.*\/league\/\d+$/, (r) => json(r, {
    league_id: '1311995695032467456', name: 'Bar Crawl', season: '2026', status: 'pre_draft',
    previous_league_id: null, scoring_settings: { rec: 0.5, pass_td: 6 },
    settings: { max_keepers: 3, num_teams: 10 },
    roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'IDP_FLEX', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'],
  }));
}

test.beforeEach(async ({ page }) => { await mockLeague(page); });

test('the board counts the picks: 150 cells, 30 already spent on keepers', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./draftboard');
  const content = page.getByTestId('content');
  await expect(content).toContainText('30 are already spent on keepers');
  await expect(content).toContainText('120 are live');
  await expect(content).toContainText('15 rounds, 10 teams');
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('keepers sit at the BOTTOM, and a sold 15th pushes one up into round 12', async ({ page }) => {
  await page.goto('./draftboard');
  const content = page.getByTestId('content');
  // Rounds 1-11 are wholly live, and the page says so rather than leaving you to count.
  await expect(content).toContainText('Rounds 1–11 are wholly live');
  // jpdonners sold his 15th, so his third keeper rode up into round 12.
  const board = page.locator('table.board');
  const r12 = board.locator('tbody tr').nth(11);
  await expect(r12.locator('.cell.keep')).toHaveCount(1);
  await expect(r12.locator('.cell.keep')).toContainText('Kept jpdonners');
});

test('the man who BOUGHT that 15th still has a live pick in round 13', async ({ page }) => {
  await page.goto('./draftboard');
  const board = page.locator('table.board');
  const r13 = board.locator('tbody tr').nth(12);
  // Nine keepers and one live cell left in round 13.
  await expect(r13.locator('.cell.keep')).toHaveCount(9);
  const live13 = r13.locator('.cell:not(.keep)');
  await expect(live13).toHaveCount(1);
  await expect(live13).toContainText('ImyHunter');
});

test('a pick that changed hands is marked with who it came from', async ({ page }) => {
  await page.goto('./draftboard');
  const traded = page.locator('table.board .cell.traded');
  await expect(traded.first()).toBeVisible();
  await expect(traded.first()).toContainText('jpdonners'); // ← the original owner
});

test('your own picks are listed, and your keepers say where they sit', async ({ page }) => {
  await page.goto('./draftboard');
  await page.getByRole('button', { name: /Your picks/ }).click();
  const content = page.getByTestId('content');
  await expect(content).toContainText('1.02');            // Ryan is slot 2 in this mock
  await expect(content).toContainText('your own slot');
  await expect(content).toContainText('Kept Ryan1');
});

test('who-holds-what shows nobody comes out even once picks are traded', async ({ page }) => {
  await page.goto('./draftboard');
  await page.getByRole('button', { name: /Who holds what/ }).click();
  const rows = page.locator('table.squad tbody tr');
  await expect(rows).toHaveCount(10);
  // ImyHunter bought a 15th, so he drafts one man too many; jpdonners is one short.
  await expect(rows.filter({ hasText: 'ImyHunter' })).toContainText('over');
  await expect(rows.filter({ hasText: 'jpdonners' })).toContainText('short');
});

test('the keepers page is a locked ledger, not a form', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./keepers');
  const content = page.getByTestId('content');
  await expect(content).toContainText('Locked.');
  await expect(content).toContainText('30 men off the board');
  // Nothing left to type.
  await expect(content.locator('input')).toHaveCount(0);
  await expect(content).toContainText('Kept Ryan1');
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the ledger says where each manager’s keeper picks landed', async ({ page }) => {
  await page.goto('./keepers');
  await expect(page.getByTestId('content')).toContainText('Keeper picks:');
});

test('phone 375px: the board scrolls sideways and the page does not', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto('./draftboard');
  await expect(page.locator('table.board')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'the page itself must not scroll sideways').toBeLessThanOrEqual(0);
  // The board's own wrapper is what scrolls.
  const scrolls = await page.locator('.boardwrap').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrolls).toBe(true);
});

test('phone 375px: the keeper ledger fits', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto('./keepers');
  await expect(page.getByTestId('content')).toContainText('Locked.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
