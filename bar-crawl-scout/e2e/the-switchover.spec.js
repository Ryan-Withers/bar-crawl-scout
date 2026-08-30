// DRAFT NIGHT ENDS AND THE APP CHANGES JOB.
//
// The whole point of this is that nobody touches anything. The last pick lands
// on Sleeper, the draft's own status reads `complete`, and within one poll the
// app stops being a prep tool: the front door leads with the grades, the Big
// Board stops offering men who have just been taken, and every page that used to
// explain how to prepare explains what happened instead.
//
// So this spec runs the app twice against the same fixtures, changing exactly
// one field — the draft's status — and asserts the app is a different app.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

const DIR = path.join(process.cwd(), 'src/lib/api/fixtures');
const read = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));

const DRAFTS = read('drafts-2026.json');
const KEEPER_PICKS = read('draft-picks-2026.json');   // the 30 keepers, pre-draft
const OLD_PICKS = read('draft-picks-2025.json');      // a real, finished draft

// A finished draft: the captured keepers, plus last year's picks replayed as
// this year's selections. Real player ids, real roster ids, real pick numbers —
// which is what the grader has to cope with.
const finished = () => {
  const keepers = KEEPER_PICKS.filter((p) => p.is_keeper);
  const taken = new Set(keepers.map((p) => String(p.player_id)));
  const drafted = OLD_PICKS
    .filter((p) => p.player_id && !taken.has(String(p.player_id)))
    .map((p, i) => ({ ...p, pick_no: i + 1, is_keeper: null }));
  return [...drafted, ...keepers];
};

async function afterTheDraft(page) {
  await mockSleeper(page);
  // Registered second, so it wins: Playwright runs the most recent handler first.
  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.endsWith('/drafts')) return json([{ ...DRAFTS[0], status: 'complete' }]);
    if (/\/draft\/\d+\/picks$/.test(url)) return json(finished());
    return route.fallback();
  });
}

test.describe('before the draft', () => {
  test.beforeEach(async ({ page }) => { await mockSleeper(page); });

  test('the front door is still counting down to it', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('phase-note')).toContainText('Draft');
    await expect(page.getByRole('link', { name: /Run a mock draft/ }).first()).toBeVisible();
  });

  test('the grades page says it will fill itself in', async ({ page }) => {
    await page.goto('./grades');
    await expect(page.getByText("The draft hasn't happened")).toBeVisible();
    // And it does NOT grade the thirty keeper picks that already sit in the feed.
    await expect(page.getByText('GRADE', { exact: true })).toHaveCount(0);
  });

  test('the pool means "not kept", so rostered non-keepers are still on the board', async ({ page }) => {
    await page.goto('./board');
    await expect(page.getByRole('button', { name: 'In pool only' })).toBeVisible();
  });
});

test.describe('the moment it is complete', () => {
  test('the front door leads with the grades instead', async ({ page }) => {
    await afterTheDraft(page);
    await page.goto('./');
    await expect(page.getByTestId('phase-note')).toContainText("The draft's done");
    await expect(page.getByRole('link', { name: /Draft grades/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Run a mock draft/ })).toHaveCount(0);
  });

  test('every manager gets a grade, off the real picks', async ({ page }) => {
    const errors = trackErrors(page);
    await afterTheDraft(page);
    await page.goto('./grades');

    await expect(page.getByText('Final.')).toBeVisible({ timeout: 20_000 });
    const rows = page.locator('.ledger').first().locator('.lrow:not(.head)');
    await expect(rows).toHaveCount(10);

    // A real grade on every row, from the same scale the mock room uses.
    const grades = await rows.locator('.grade').allInnerTexts();
    expect(grades).toHaveLength(10);
    for (const g of grades) expect(g).toMatch(/^(A\+|A-|A|B\+|B-|B|C\+|C-|C|D)$/);

    // The grades have to actually separate the room. Ten identical letters would
    // mean the number underneath is not measuring anything.
    expect(new Set(grades).size).toBeGreaterThan(1);

    // And it says what it is not counting, rather than quietly dropping it.
    await expect(page.getByText(/picks graded/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the board stops offering men who have just been drafted', async ({ page }) => {
    await afterTheDraft(page);
    await page.goto('./board');
    // The chip renames itself, because "in pool" now means the waiver wire.
    await expect(page.getByRole('button', { name: 'Free agents only' })).toBeVisible({ timeout: 20_000 });
  });
});
