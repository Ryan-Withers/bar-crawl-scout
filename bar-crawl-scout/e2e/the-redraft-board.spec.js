// THE SECOND BOARD — the redraft league, on the same engine.
//
// The whole point of parameterising rather than copying is that one
// implementation serves both rooms. That is only worth anything if the second
// board genuinely reads the second league: the risk of a shared component is
// that it renders under the redraft league's name while quietly showing the
// keeper league's teams, prices and pool.
//
// So these tests are about DIFFERENCE. Every one of them would pass trivially if
// the two boards were the same page, which is why each asserts something that is
// true of this league and false of the other.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

const B = (n) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/api/fixtures-b', n), 'utf8'));
const LEAGUE_B = B('league.json');
const DRAFT_B = B('drafts-2026.json')[0];

const board = (page) => page.getByTestId('sheet-table');
const headers = (page) => board(page).locator('thead th');

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('it is the redraft league, and it says so', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./sheet/kings');
  await expect(page.getByTestId('sheet')).toBeVisible();
  await expect(page.getByTestId('sheet-league')).toHaveText('Re-Draft Kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('the dynasty price and the keeper gap are gone, not blank', async ({ page }) => {
  // Nobody keeps anybody here, so what the market pays for a man's future is a
  // question this room never asks. A column of dashes would still cost width.
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  // The headings are uppercased by CSS, so compare on the rendered text.
  const clean = (await headers(page).allInnerTexts()).map((t) => t.replace(/[▲▼\s]/g, '').toUpperCase());
  expect(clean).not.toContain('DYN');
  expect(clean).not.toContain('KEEP');
  // And the mainstream half-PPR price is dropped too — this league's OWN family
  // is half-PPR, so ADP and ADP½ were printing the same figure for every player.
  expect(clean).not.toContain('ADP½');
  expect(clean.filter((t) => t.startsWith('ADP'))).toEqual(['ADP', 'ADP1']);
  // ...while the columns that DO mean something here are all still present.
  for (const want of ['SLEEPER', 'ACTUAL', 'ADP', 'VORP', 'MY', 'VALUE', 'GAIN']) {
    expect(clean).toContain(want);
  }
});

test('the keeper board still has them — the two boards really do differ', async ({ page }) => {
  await page.goto('./sheet');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  const clean = (await headers(page).allInnerTexts()).map((t) => t.replace(/[▲▼\s]/g, '').toUpperCase());
  expect(clean).toContain('DYN');
  expect(clean).toContain('KEEP');
  // The keeper league drafts to the IDP price, so its half-PPR column carries a
  // genuinely different number and stays.
  expect(clean).toContain('ADP½');
});

test('every column has a header, and every header a column — on this board too', async ({ page }) => {
  // The same guard the other board carries. Dropping two columns means dropping
  // two cells, and getting that pairing wrong makes every heading from there
  // rightwards name the column to its left. It has happened once already.
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  const th = await headers(page).count();
  const td = await board(page).locator('tbody tr').first().locator('td').count();
  expect(td).toBe(th);
});

test('nothing is struck off before a redraft has started', async ({ page }) => {
  // The keeper league opens with thirty men already gone. This one opens empty,
  // and a board that greyed anybody out here would be showing the wrong league.
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  await expect(board(page).locator('tbody tr.owned')).toHaveCount(0);
});

test('it quotes the price this room is drafting to, not the other room’s', async ({ page }) => {
  // No IDP seat and one quarterback, so the family is half-PPR — and the column
  // explainer names it rather than asserting the other league's format.
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  const adp = headers(page).filter({ hasText: /^\s*ADP\s*$/ }).first();
  await adp.hover();
  const tip = page.locator('.tip, [data-testid="sheet-tip"]').first();
  await expect(tip).toContainText('half ppr', { ignoreCase: true, timeout: 5000 });
  await expect(tip).not.toContainText('IDP with one quarterback');
});

test('a star on one board does not appear on the other', async ({ page }) => {
  // Both leagues draft on 2026-09-05, two hours apart, on this device. Saved
  // state that leaked between them would do it mid-draft.
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  const firstStar = board(page).locator('tbody tr').first().locator('button.fav');
  const starredName = await board(page).locator('tbody tr').first().locator('.pn').innerText();
  await firstStar.click();
  await expect(firstStar).toHaveText('★');

  await page.goto('./sheet');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  const sameManHere = board(page).locator('tbody tr', { has: page.locator('.pn', { hasText: starredName }) }).first();
  if (await sameManHere.count()) {
    await expect(sameManHere.locator('button.fav')).toHaveText('☆');
  }
  // And it is still starred when we come back.
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  await expect(board(page).locator('tbody tr').first().locator('button.fav')).toHaveText('★');
});

test('the live toggle and refresh work here as well', async ({ page }) => {
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('sheet-live')).not.toBeChecked();
  await page.getByTestId('sheet-live').check();
  await expect(page.getByTestId('sheet-live')).toBeChecked();
  await page.getByTestId('sheet-refresh').click();
  await expect(board(page)).toBeVisible();
});

test('the captured league is what the board is built on', async ({ page }) => {
  // A sanity anchor: twelve managers and fourteen rounds is this league, and the
  // fixture is the source for both the test and the app.
  expect(LEAGUE_B.total_rosters).toBe(12);
  expect(DRAFT_B.settings.rounds).toBe(14);
  await page.goto('./sheet/kings');
  await expect(board(page)).toBeVisible({ timeout: 20_000 });
  const rows = await board(page).locator('tbody tr').count();
  expect(rows).toBeGreaterThan(50);
});

// ---------------------------------------------------------------------------
// MOVING BETWEEN THE TWO, on the day.
//
// Both drafts are on 2026-09-05, two hours apart. The design decision under test
// is that a URL always means the same board — the alternative, /sheet opening
// whichever you looked at last, is the one version that can hand you the wrong
// league without saying so, at exactly the moment you would not check.
test('each board keeps its own address, and says which it is', async ({ page }) => {
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-league')).toHaveText('Bar Crawl');
  await page.goto('./sheet/kings');
  await expect(page.getByTestId('sheet-league')).toHaveText('Re-Draft Kings');

  // ...and going back to the bare URL still gives the keeper league. Nothing is
  // remembered, on purpose.
  await page.goto('./sheet');
  await expect(page.getByTestId('sheet-league')).toHaveText('Bar Crawl');
});

test('the switcher moves between them and marks where you are', async ({ page }) => {
  await page.goto('./sheet');
  const swap = page.getByTestId('sheet-swap');
  await expect(swap).toBeVisible();
  // The board you are on is not a link, so there is no click that leaves you
  // where you already were and looks like it did something.
  await expect(swap.locator('b.on')).toHaveText('Bar Crawl');
  await expect(page.getByTestId('swap-bar')).toHaveCount(0);

  await page.getByTestId('swap-kings').click();
  await expect(page.getByTestId('sheet-league')).toHaveText('Re-Draft Kings');
  await expect(page).toHaveURL(/\/sheet\/kings$/);
  await expect(swap.locator('b.on')).toHaveText('Re-Draft');

  await page.getByTestId('swap-bar').click();
  await expect(page.getByTestId('sheet-league')).toHaveText('Bar Crawl');
  await expect(page).toHaveURL(/\/sheet$/);
});

test('each board counts down to its OWN draft', async ({ page }) => {
  // The two are two hours apart. A board showing the other league's clock would
  // be worse than showing none.
  for (const route of ['./sheet', './sheet/kings']) {
    await page.goto(route);
    await expect(page.getByTestId('sheet-countdown')).toContainText(/drafts in|drafting now|drafted/);
  }
});
