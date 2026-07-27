// THE VAULT — past drafts and what became of every pick. The persona: a mate
// who wants to settle an argument about who actually drafts well, and a
// newcomer who's never seen a draft board before.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

// Two seasons, two managers, four picks a season — small enough that every
// number the page prints is checkable by hand.
const USERS = [
  { user_id: '1', display_name: 'witherssssss' },
  { user_id: '2', display_name: 'joshleota' },
];
// Today: ryan still has Ada; josh has Bo AND Di (poached off ryan); Cy is gone.
const ROSTERS = [
  { roster_id: 1, owner_id: '1', players: ['p1'], starters: ['p1'], settings: { wins: 8, losses: 3, fpts: 1400 } },
  { roster_id: 2, owner_id: '2', players: ['p2', 'p4'], starters: ['p2'], settings: { wins: 6, losses: 5, fpts: 1300 } },
];
const pick = (over, round, slot, rid, pid, first, last, pos) => ({
  pick_no: over, round, draft_slot: slot, roster_id: rid, player_id: pid,
  metadata: { first_name: first, last_name: last, position: pos, team: 'NYJ' },
});
const PICKS_2025 = [
  pick(1, 1, 1, 1, 'p1', 'Ada', 'One', 'RB'),
  pick(2, 1, 2, 2, 'p2', 'Bo', 'Two', 'WR'),
  pick(3, 2, 2, 2, 'p3', 'Cy', 'Three', 'QB'),
  pick(4, 2, 1, 1, 'p4', 'Di', 'Four', 'TE'),
];
const PICKS_2024 = [
  pick(1, 1, 1, 2, 'p9', 'Ed', 'Five', 'WR'),
  pick(2, 1, 2, 1, 'p1', 'Ada', 'One', 'RB'),
];

// Two leagues chained by previous_league_id, each with one complete draft.
async function mockVault(page, { drafts2025 = true } = {}) {
  await mockSleeper(page);
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (/\/league\/L2025$/.test(url)) return json({ league_id: 'L2025', season: '2025', previous_league_id: 'L2024', scoring_settings: {} });
    if (/\/league\/L2024$/.test(url)) return json({ league_id: 'L2024', season: '2024', previous_league_id: null, scoring_settings: {} });
    if (/\/league\/\d+$/.test(url)) return json({ league_id: 'L2025', season: '2025', previous_league_id: 'L2024', scoring_settings: {} });
    if (url.endsWith('/users')) return json(USERS);
    if (url.endsWith('/rosters')) return json(ROSTERS);
    if (url.endsWith('/drafts')) {
      if (url.includes('L2024')) return json([{ draft_id: 'D2024', season: '2024', status: 'complete', type: 'snake' }]);
      return json(drafts2025 ? [{ draft_id: 'D2025', season: '2025', status: 'complete', type: 'snake' }] : []);
    }
    if (url.endsWith('/D2025/picks')) return json(PICKS_2025);
    if (url.endsWith('/D2024/picks')) return json(PICKS_2024);
    if (url.includes('/players/nfl')) return json({});
    return json([]);
  });
}

test('the vault opens on the newest draft and says what it is looking at', async ({ page }) => {
  const errors = trackErrors(page);
  await mockVault(page);
  await page.goto('./vault');

  // The shell names the page, and the page states its own finding in a sentence.
  await expect(page.getByRole('heading', { name: 'Past Drafts', level: 1 })).toBeVisible();
  const headline = page.getByTestId('vault-headline');
  // ryan kept Ada (1 of 2); josh kept Bo but lost Cy (1 of 2) -> 2 of 4, 50%.
  await expect(headline).toContainText('2 of the 4 players taken in the 2025 draft');
  await expect(headline).toContainText('(50%)');

  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the board lays the picks out round by round and the slot holds a manager', async ({ page }) => {
  await mockVault(page);
  await page.goto('./vault');

  const board = page.getByTestId('vault-board');
  await expect(board).toBeVisible();
  await expect(board.locator('tbody tr')).toHaveCount(2); // two rounds
  await expect(board).toContainText('Ada One');
  await expect(board).toContainText('Di Four');

  // Round 2 snakes, but a manager keeps his column: ryan drafted 1st and 4th,
  // so both his players sit in the first pick column.
  const col = (r, c) => board.locator('tbody tr').nth(r).locator('td').nth(c);
  await expect(col(0, 0)).toContainText('Ada One');
  await expect(col(1, 0)).toContainText('Di Four');
  await expect(col(1, 1)).toContainText('Cy Three');
});

test('switching season swaps the board to the older draft', async ({ page }) => {
  await mockVault(page);
  await page.goto('./vault');
  await expect(page.getByTestId('vault-board')).toContainText('Ada One');

  await page.getByTestId('vault-season-2024').click();
  await expect(page.getByTestId('vault-headline')).toContainText('2024 draft');
  await expect(page.getByTestId('vault-board')).toContainText('Ed Five');
});

test('who-held-on shows each manager\'s hold rate and who poached whom', async ({ page }) => {
  await mockVault(page);
  await page.goto('./vault');
  await page.getByTestId('vault-tab-holders').click();

  // ryan: 2 picks, kept Ada, lost Di to josh -> 50%.
  const ryan = page.getByTestId('vault-holder-Ryan');
  await expect(ryan).toContainText('50%');
  await expect(ryan).toContainText('1 of 2 picks still theirs');
  await expect(ryan).toContainText('Longest held: Ada One');

  // The poach ledger names the player and both ends of the move, using the same
  // team names the holder cards do (read them off the page so a rename in
  // data.js can't turn this into a false failure).
  await expect(page.getByText(/who took whose/i)).toBeVisible();
  const teamOf = (h) => page.getByTestId('vault-holder-' + h).locator('.hname').innerText();
  const [from, to] = [await teamOf('Ryan'), await teamOf('joshleota')];
  expect(from).not.toBe(to);
  await expect(page.locator('.poach li', { hasText: 'Di Four' })).toContainText(`${from} → ${to}`);
});

test('a league with no completed draft is told so, not left blank', async ({ page }) => {
  await mockVault(page, { drafts2025: false });
  await page.goto('./vault');
  // 2024 still has one, so the page works — the point is it never renders empty.
  await expect(page.getByTestId('vault-board')).toBeVisible();
  await expect(page.getByTestId('vault-season-2024')).toBeVisible();
  await expect(page.getByTestId('vault-season-2025')).toHaveCount(0);
});

test('the vault fits a phone and is reachable from the draft nav', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockVault(page);
  await page.goto('./vault');
  await expect(page.getByTestId('vault-headline')).toBeVisible();

  // The board scrolls sideways in its own box; the PAGE must not.
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(2);

  // And a newcomer can find it: the drawer lists it with a description.
  await page.getByTestId('tab-more').click();
  const drawer = page.getByTestId('drawer');
  await expect(drawer.getByTestId('nav-vault')).toContainText(/who still owns what they took/i);
  await drawer.getByTestId('nav-vault').click();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/vault$/);
});
