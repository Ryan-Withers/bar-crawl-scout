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
  const txns2026 = read('transactions-2026-1.json');
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
    if (/\/league\/\d+\/transactions\/1$/.test(url)) return json(r, txns2026);
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
  // jpdonners is 6 short on the raw board — and 8 short once the two keepers he
  // has already sold to ImyHunter actually leave.
  await expect(rows.filter({ hasText: 'jpdonners' })).toContainText('8 short');
  await expect(page.getByTestId('content')).toContainText('After the deals');
  await page.screenshot({ path: 'shots/holds-what.png', fullPage: true });

  await page.goto('./keepers');
  const led = page.getByTestId('content');
  await expect(led).toContainText('Locked.');
  await expect(led).toContainText('30 men off the board');
  await expect(led).toContainText('Back in the pool (125)');
  // Thirteen men are on their second straight year with the same manager, and
  // four more changed hands — the case the league's own rule decides.
  await expect(led.getByText('Last Call')).toHaveCount(17);
  // Exact: "traded in" the badge, not the "traded in principle" line below it.
  await expect(led.getByText('traded in', { exact: true })).toHaveCount(4);
  // The big names who came BACK, which is the whole story of this draft.
  await expect(led).toContainText('Josh Allen');
  await expect(led).toContainText('Drake London');
  // TRADES IN PRINCIPLE — agreed now, executed after the draft. The rosters are
  // deliberately, temporarily wrong and the page has to say so.
  await expect(led).toContainText('traded in principle');
  const joshLedger = page.locator('.sheet', { hasText: '@joshleota' });
  await expect(joshLedger).toContainText('Puka Nacua');
  await expect(joshLedger).toContainText('→ Ryan');       // Nacua is coming to Ryan
  const jpLedger = page.locator('.sheet', { hasText: '@jpdonners' });
  await expect(jpLedger).toContainText('→ ImyHunter');    // Lamb and Flowers are going
  const ryanLedger = page.locator('.sheet', { hasText: '@Ryan' });
  await expect(ryanLedger).toContainText('After the draft:');
  await expect(ryanLedger).toContainText('Puka Nacua');
  await page.screenshot({ path: 'shots/keepers.png', fullPage: true });

  // THE TRADE DESK — a pick is offered per SEAT and priced on the snake.
  await page.goto('./trade');
  const pickSelect = page.getByTestId('pick-give');
  await expect(pickSelect).toBeVisible();
  const labels = await pickSelect.locator('option').allTextContents();

  // Every manager's round is offered, not one anonymous "R2".
  expect(labels.filter((l) => /^2026 R2 · /.test(l))).toHaveLength(10);
  // Rounds 11 and 12 are live and tradeable — the old table stopped at 10, so
  // this league's three round-11 trades could not be entered at all.
  expect(labels.some((l) => /^2026 R11 · /.test(l))).toBe(true);
  expect(labels.some((l) => /^2026 R12 · /.test(l))).toBe(true);
  // ...and the keeper rounds are not offered, because nobody picks in them.
  expect(labels.some((l) => /^2026 R1[345] · /.test(l))).toBe(false);
  // Next year's picks too — the futures the app never used to price.
  expect(labels.some((l) => /^2027 R1 · /.test(l))).toBe(true);

  // The SAME round at two seats is not the same asset. Round 2 snakes back, so
  // the slot-10 seat picks first and is worth more than the slot-1 seat.
  const priceIn = (label) => {
    const hit = labels.find((l) => l.startsWith(label));
    return hit ? Number(hit.match(/~(\d+)/)[1]) : null;
  };
  const r2slot1 = priceIn('2026 R2 · Egbukakke');        // ImyHunter, slot 1
  const r2slot10 = priceIn('2026 R2 · Nice like Rice');  // jduddy9, slot 10
  expect(r2slot1, 'slot 1 round 2 is priced').not.toBeNull();
  expect(r2slot10, 'slot 10 round 2 is priced').not.toBeNull();
  expect(r2slot10).toBeGreaterThan(r2slot1);
  // ...and round 1 runs the other way, which is the snake doing its job.
  expect(priceIn('2026 R1 · Egbukakke')).toBeGreaterThan(priceIn('2026 R1 · Nice like Rice'));

  expect(errors, errors.join('\n')).toHaveLength(0);

  await page.goto('./managers');
  await page.waitForTimeout(3500);
  // The manager folders must show the LOCKED keepers, not the old projections.
  const mgr = page.getByTestId('content');
  await expect(mgr).toContainText('DeVonta Smith');   // joshleota's real third
  await expect(mgr).not.toContainText('Drake London'); // the guess he replaced
  await expect(mgr).toContainText('Keepers');            // not "Projected keepers"
  // joshleota holds a 2026 first and four 2027 firsts, so he is not STRIPPED —
  // the stamp used to read off the stale hand-counted constant.
  const josh = page.locator('article', { hasText: '@joshleota' });
  await expect(josh).not.toContainText('STRIPPED');
  await expect(josh).toContainText('2027: 4');
  await page.screenshot({ path: 'shots/managers.png', fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./draftboard');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'shots/draftboard-phone.png', fullPage: true });
});
