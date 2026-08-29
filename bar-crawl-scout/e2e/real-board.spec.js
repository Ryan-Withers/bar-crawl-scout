// THE REAL THING — the app driven by the CAPTURED league, not a synthetic mock.
//
// Every other spec builds a miniature league to prove one behaviour. This one
// serves Ryan's actual fixtures — ten managers, thirty locked keepers, forty-
// seven traded 2026 picks, two sold fifteenths — and asserts the numbers that
// come out the far end. If the keeper rework is ever quietly reverted, this is
// the test that notices, because it is reconciled against reality rather than
// against a fixture written to agree with the code.
//
// It also leaves screenshots in shots/, so what ships can be looked at rather
// than inferred from a test name.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const F = path.join(process.cwd(), 'src/lib/api/fixtures');
const read = (n) => JSON.parse(fs.readFileSync(path.join(F, n), 'utf8'));

test('the captured league renders end to end, and the numbers hold', async ({ page }) => {
  const users = read('users-2026.json');
  const rosters = read('rosters-2026.json');
  const drafts = read('drafts-2026.json');
  const picks = read('draft-picks-2026.json');
  const traded = read('traded_picks-2026.json');
  const league = read('league.json');
  const blob = read('players-trimmed.json');
  const draftId = drafts[0].draft_id;

  // The PREVIOUS season too — the contract clock ("is this his last year?") is
  // derived from last season's is_keeper picks, so a chain that dead-ends makes
  // every keeper look like a fresh one.
  const l25 = read('league-2025.json');
  const d25 = read('drafts-2025.json');
  const p25 = read('draft-picks-2025.json');
  const u25 = read('users-2025.json');
  const r25 = read('rosters-2025.json');
  const prevId = l25.league_id;
  const draft25 = d25[0].draft_id;

  const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  await page.route(/api\.sleeper\.app/, (r) => {
    const url = r.request().url().split('?')[0];
    if (url.endsWith('/state/nfl')) return json(r, read('state.json'));
    if (url.endsWith(`/league/${prevId}/users`)) return json(r, u25);
    if (url.endsWith(`/league/${prevId}/rosters`)) return json(r, r25);
    if (url.endsWith(`/league/${prevId}/drafts`)) return json(r, d25);
    if (url.endsWith(`/league/${prevId}`)) return json(r, l25);
    if (url.endsWith(`/draft/${draft25}/picks`)) return json(r, p25);
    if (url.endsWith('/users')) return json(r, users);
    if (url.endsWith('/rosters')) return json(r, rosters);
    if (url.endsWith('/drafts')) return json(r, drafts);
    if (url.endsWith(`/draft/${draftId}/picks`)) return json(r, picks);
    // EXACT path: the app must ask the LEAGUE for traded picks, because that is
    // the only endpoint carrying the 2027 futures. A suffix match here hid the
    // fact that it was asking the draft instead.
    if (url.endsWith(`/league/${league.league_id}/traded_picks`)) return json(r, traded);
    if (url.includes('/players/nfl')) return json(r, blob);
    if (/\/league\/\d+$/.test(url)) return json(r, league);
    return json(r, []);
  });
  await page.route(/workers\.dev/, (r) => json(r, { ts: '', rosters: {} }));

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./draftboard');
  const board = page.getByTestId('content');
  await expect(board).toContainText('30 are already spent on keepers');
  await expect(board).toContainText('120 are live');
  await expect(board).toContainText('Rounds 1–11 are wholly live');
  // The two sold fifteenths, riding up into round 12.
  const r12 = page.locator('table.board tbody tr').nth(11);
  await expect(r12.locator('.cell.keep')).toHaveCount(2);
  await expect(r12).toContainText("Ja'Marr Chase");
  await expect(r12).toContainText('Zay Flowers');
  // ...and the two live picks left behind in round 13.
  const r13 = page.locator('table.board tbody tr').nth(12);
  await expect(r13.locator('.cell:not(.keep)')).toHaveCount(2);
  await page.screenshot({ path: 'shots/draftboard.png', fullPage: true });

  await page.getByRole('button', { name: /Your picks/ }).click();
  const codes = await page.locator('.mine li b').allTextContents();
  expect(codes).toHaveLength(13);
  expect(codes[0]).toBe('1.04');
  expect(codes[codes.length - 1]).toBe('11.06');
  // No second-rounder at all — he traded it to ATorelli4.
  expect(codes.filter((c) => c.startsWith('2.'))).toEqual([]);
  // Three thirds, two of them bought.
  expect(codes.filter((c) => c.startsWith('3.'))).toHaveLength(3);

  await page.getByRole('button', { name: /Who holds what/ }).click();
  const rows = page.locator('table.squad tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(rows.filter({ hasText: 'ATorelli4' })).toContainText('7 over');
  await expect(rows.filter({ hasText: 'jpdonners' })).toContainText('6 short');
  await page.screenshot({ path: 'shots/holds-what.png', fullPage: true });

  await page.goto('./keepers');
  const led = page.getByTestId('content');
  await expect(led).toContainText('Locked.');
  await expect(led).toContainText('30 men off the board');
  await expect(led).toContainText('Back in the pool (125)');
  // Thirteen men are on their second straight year with the same manager, and
  // four more changed hands — the case the league's own rule decides.
  await expect(led.getByText('Last Call')).toHaveCount(17);
  await expect(led.getByText('traded in')).toHaveCount(4);
  // The big names who came BACK, which is the whole story of this draft.
  await expect(led).toContainText('Josh Allen');
  await expect(led).toContainText('Drake London');
  await page.screenshot({ path: 'shots/keepers.png', fullPage: true });

  expect(errors, errors.join('\n')).toHaveLength(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./draftboard');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'shots/draftboard-phone.png', fullPage: true });
});
