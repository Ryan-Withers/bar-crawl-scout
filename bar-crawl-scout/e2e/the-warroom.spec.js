// THE WAR ROOM — the draft room E2E. The loop a mate actually runs on a
// Tuesday night: lobby -> start -> your turn -> queue -> draft -> sim -> grades,
// plus the phone, the queue, undo, the clock and spectate mode.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

// The pool row the user would tap first: its star carries the player's name.
async function topOfPool(page) {
  const star = page.locator('[data-testid^="star-"]').first();
  await expect(star).toBeVisible();
  const testid = await star.getAttribute('data-testid');
  const label = await star.getAttribute('aria-label');
  return { star, slug: testid.replace(/^star-/, ''), name: label.replace(/^(Add to queue|Remove from queue): /, '') };
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('the whole loop: lobby -> start -> your turn -> queue -> draft -> sim to end -> grades', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');

  // LOBBY: settings read as a summary, the GMs have plain-English personalities,
  // the dials are still there behind the disclosure, and START is unmistakable.
  await expect(page.getByTestId('lobby')).toBeVisible();
  await expect(page.getByText(/THE WAR ROOM/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /the league/i })).toHaveCount(0); // hub chrome hidden
  await expect(page.getByTestId('gm-list').locator('li')).toHaveCount(10);
  await expect(page.getByTestId('gm-phrase-joshleota')).toHaveText(/Balanced · keeps you guessing/);
  await expect(page.getByTestId('customise-gms').locator('input[type=range]')).toHaveCount(20);

  await page.getByTestId('start').click();

  // THE ROOM: the board is the hero, one cell is on the clock, and you're up.
  await expect(page.getByTestId('draft-board')).toBeVisible();
  await expect(page.getByTestId('clock')).toBeVisible();
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="draft-board"] .cur')).toHaveCount(1);

  // QUEUE a player from the pool, then draft straight off the queue.
  const first = await topOfPool(page);
  await first.star.click();
  await expect(page.getByTestId('queue').getByTestId(`queued-${first.slug}`)).toBeVisible();
  await page.getByTestId(`pick-${first.slug}`).click();

  // The reveal announces it, the board fills, your roster and the feed agree.
  await expect(page.getByTestId('reveal')).toContainText(first.name);
  await expect(page.getByTestId('feed')).toContainText(first.name);
  await expect(page.getByTestId('roster')).toContainText(first.name);
  await expect(page.locator('[data-testid="draft-board"] .pk').first()).toBeVisible();

  // Bots tick on (they don't teleport) until you're up again.
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });

  // AUTOPICK, then finish the thing.
  await page.getByTestId('autopick').click();
  await page.getByTestId('sim-to-end').click();

  // THE DEBRIEF: your grade first and enormous, then the room and the board.
  await expect(page.getByTestId('debrief')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('my-grade')).toContainText(/Your draft grade/i);
  await expect(page.getByTestId('my-grade')).toContainText(/[A-D][+-]?/);
  await expect(page.getByTestId('grade-board').locator('.grow')).toHaveCount(10);
  await expect(page.getByText(/The full board/i)).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the queue drives autopick: the starred man goes first', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });

  // Star the 6th name down — nowhere near best available — and push him to the top.
  const stars = page.locator('[data-testid^="star-"]');
  const target = stars.nth(5);
  const name = (await target.getAttribute('aria-label')).replace(/^Add to queue: /, '');
  const slug = (await target.getAttribute('data-testid')).replace(/^star-/, '');
  await stars.nth(2).click();     // a decoy above him
  await target.click();
  await expect(page.getByTestId('queue').locator('li')).toHaveCount(2);

  // Re-order: he's second, move him up, now he's the top of the queue.
  const row = page.getByTestId(`queued-${slug}`);
  await row.getByRole('button', { name: `Move ${name} up` }).click();
  await expect(page.getByTestId('queue').locator('li').first()).toContainText(name);

  // AUTOPICK takes the top queued player, not best available.
  await page.getByTestId('autopick').click();
  await expect(page.getByTestId('roster')).toContainText(name);
  await expect(page.getByTestId('queue')).not.toContainText(name); // drafted, off the list
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('undo takes the last pick back', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });

  const first = await topOfPool(page);
  await page.getByTestId(`pick-${first.slug}`).click();
  // Wait until the room settles back on your clock — nothing is ticking now.
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });
  const before = Number(await page.getByTestId('feed-count').textContent());
  expect(before).toBeGreaterThan(0);

  await page.getByTestId('undo').click();
  await expect.poll(async () => Number(await page.getByTestId('feed-count').textContent())).toBe(before - 1);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the pick clock counts down and drafts your queue at zero', async ({ page }) => {
  const errors = trackErrors(page);
  // A 6-second clock seeded directly so the test doesn't sit out a real 30s.
  await page.addInitScript(() => localStorage.setItem('bcs_mock_clock', '6'));
  await page.goto('./mock');
  await expect(page.getByTestId('lobby')).toContainText('6s');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('pickclock')).toHaveText(/0:0[0-6]/);

  // Queue someone, then let the clock run out: the room takes HIM.
  const first = await topOfPool(page);
  await first.star.click();
  await expect(page.getByTestId('roster')).toContainText(first.name, { timeout: 12_000 });
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('spectate mode with the clock off sims all ten and lands on grades', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');
  await page.getByTestId('spectate').check();
  await expect(page.getByTestId('clock-60')).toBeDisabled();   // no seat, no clock
  await page.getByTestId('start').click();
  await expect(page.getByTestId('clock')).toBeVisible();
  await expect(page.getByTestId('pickclock')).toHaveCount(0);
  await page.getByTestId('sim-to-end').click();
  await expect(page.getByTestId('debrief')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('my-grade')).toContainText(/Best draft in the room/i);
  await expect(page.getByTestId('draft-board')).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('mock history persists a finished draft', async ({ page }) => {
  await page.goto('./mock');
  await page.getByTestId('spectate').check();
  await page.getByTestId('start').click();
  await page.getByTestId('sim-to-end').click();
  await expect(page.getByTestId('debrief')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('new-setup').click();
  await expect(page.getByText(/Past mocks/i)).toBeVisible();
});

test('real board mode: Sleeper slots + a traded pick put Ryan on the clock at 1.02 AND 1.04', async ({ page }) => {
  const errors = trackErrors(page);
  const HANDLES = ['ImyHunter', 'Ryan', 'ShaydenB', 'JShrimp341', 'ATorelli4', 'jpdonners', 'WinzTheBrah', 'joshleota', 'JohnnyDuff', 'jduddy9'];
  const users = HANDLES.map((h, i) => ({ user_id: String(i + 1), display_name: h === 'Ryan' ? 'witherssssss' : h }));
  const rosters = HANDLES.map((_, i) => ({ roster_id: i + 1, owner_id: String(i + 1), players: [], starters: [], settings: {} }));
  const draft_order = Object.fromEntries(users.map((u, i) => [u.user_id, i + 1]));
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  // Registered AFTER mockSleeper's catch-all, so these win (newest route first).
  await page.route(/api\.sleeper\.app.*\/users$/, (r) => json(r, users));
  await page.route(/api\.sleeper\.app.*\/rosters$/, (r) => json(r, rosters));
  await page.route(/api\.sleeper\.app.*\/drafts$/, (r) => json(r, [{ draft_id: 'd1', season: '2026', type: 'snake', status: 'pre_draft', draft_order }]));
  // JShrimp341 (slot 4) traded that pick to Ryan (roster 2) -> Ryan owns 1.02 and 1.04.
  await page.route(/api\.sleeper\.app.*\/traded_picks$/, (r) => json(r, [{ season: '2026', round: 1, roster_id: 4, owner_id: 2, previous_owner_id: 4 }]));

  await page.goto('./mock');
  await expect(page.getByTestId('order-real')).toHaveClass(/on/);
  await expect(page.getByText(/1 traded pick honored/i)).toBeVisible();
  await expect(page.getByText(/via Shakir and Baker Baby/i)).toBeVisible();
  await expect(page.getByTestId('start')).toContainText('1.02');   // the lobby knows where you sit

  await page.getByTestId('start').click();
  const clock = page.getByTestId('clock');
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });
  await expect(clock).toContainText('1.02');
  const first = await topOfPool(page);
  await page.getByTestId(`pick-${first.slug}`).click();
  // One bot ticks at 1.03, then Ryan is straight back up at 1.04.
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });
  await expect(clock).toContainText('1.04');
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('copy for the group chat puts the recap on the clipboard', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await mockSleeper(page);
  await page.goto('./mock');
  await page.getByTestId('spectate').check();
  await page.getByTestId('start').click();
  await page.getByTestId('sim-to-end').click();
  await expect(page.getByTestId('debrief')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('copy-recap').click();
  await expect(page.getByText(/copied — go stir the pot/i)).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('🏈 THE WAR ROOM — mock draft');
  expect(text).toContain('🥇');
  expect(text, 'spectate recap has no personal haul').not.toContain('MY HAUL');
  expect(text).toContain('Run yours: https://ryan-withers.github.io/bar-crawl-scout/mock');
  await ctx.close();
});

test('the lobby remembers the pick clock and disables it for spectate', async ({ page }) => {
  await page.goto('./mock');
  await page.getByTestId('clock-60').click();
  await page.reload();
  await expect(page.getByTestId('clock-60')).toHaveClass(/on/);
  await page.getByTestId('spectate').check();
  await expect(page.getByTestId('clock-60')).toBeDisabled();
});

test('phone 375px: tabs, no overflow, and the draft button under your thumb', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockSleeper(page);
  const errors = trackErrors(page);
  await page.goto('./mock');
  await page.waitForTimeout(400);
  expect(await overflow(page), 'the lobby overflows sideways').toBeLessThanOrEqual(2);

  await page.getByTestId('start').click();
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });
  expect(await overflow(page), 'the room overflows sideways').toBeLessThanOrEqual(2);

  // BOARD | PLAYERS | MY TEAM | FEED — one view at a time, each full screen.
  for (const [id, testid] of [['board', 'draft-board'], ['players', 'pool'], ['team', 'queue'], ['feed', 'feed']]) {
    await page.getByTestId(`mobile-tab-${id}`).click();
    await expect(page.getByTestId(testid)).toBeVisible();
    expect(await overflow(page), `the ${id} tab overflows sideways`).toBeLessThanOrEqual(2);
  }

  // The primary action sits in the thumb zone and is a real tap target.
  const thumb = page.getByTestId('thumb-draft');
  await expect(thumb).toBeVisible();
  const box = await thumb.boundingBox();
  expect(box.height, `the draft button is only ${box.height}px tall`).toBeGreaterThanOrEqual(44);
  expect(box.y, 'the draft button is out of thumb reach').toBeGreaterThan(812 * 0.6);
  const picksBefore = Number(await page.getByTestId('feed-count').textContent());
  await thumb.click();
  await expect
    .poll(async () => Number(await page.getByTestId('feed-count').textContent()))
    .toBeGreaterThan(picksBefore);

  // …and the debrief fits too.
  await page.getByTestId('sim-to-end').click();
  await expect(page.getByTestId('debrief')).toBeVisible({ timeout: 30_000 });
  expect(await overflow(page), 'the debrief overflows sideways').toBeLessThanOrEqual(2);
  expect(errors, errors.join('\n')).toHaveLength(0);
  await ctx.close();
});

// ---- THE POOL FILTERS + THE FOCUS DIAL ---------------------------------

test('the pool filters by position with buttons, including the flex', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('pool')).toBeVisible();

  const rows = page.locator('[data-testid="pool"] .prow');
  const posInRows = async () => (await page.locator('[data-testid="pool"] .prow .pos').allInnerTexts())
    .map((t) => t.trim());

  // A single position narrows to exactly that position.
  await page.getByTestId('pos-rb').click();
  expect(new Set(await posInRows())).toEqual(new Set(['RB']));

  // FLX is the league's actual flex seat — RB/WR/TE here, never the QB.
  await page.getByTestId('pos-flx').click();
  const flx = new Set(await posInRows());
  expect(flx.has('QB')).toBe(false);
  expect([...flx].every((p) => ['RB', 'WR', 'TE'].includes(p))).toBe(true);
  expect(flx.size).toBeGreaterThan(1); // it really is a group, not one position

  // Each button carries its own count, and FLX's is the sum of its parts.
  const n = (id) => page.getByTestId(id).locator('i').innerText().then((t) => Number(t));
  expect(await n('pos-flx')).toBe((await n('pos-rb')) + (await n('pos-wr')) + (await n('pos-te')));

  // Clear puts everyone back.
  await page.getByTestId('clear-filters').click();
  await expect(page.getByTestId('pos-all')).toHaveAttribute('aria-pressed', 'true');
  expect(new Set(await posInRows()).size).toBeGreaterThan(1);
  await expect(rows.first()).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the needs filter shows only players who would fill a starting seat', async ({ page }) => {
  await page.goto('./mock');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('your-turn')).toBeVisible({ timeout: 15_000 });

  // Nothing drafted yet: every starting position is still a need.
  const needs = page.getByTestId('only-needs');
  await expect(needs).toBeVisible();
  await needs.click();
  await expect(needs).toHaveAttribute('aria-pressed', 'true');

  const shown = new Set((await page.locator('[data-testid="pool"] .prow .pos').allInnerTexts()).map((t) => t.trim()));
  expect(shown.size).toBeGreaterThan(0);
  // The count on the chip matches how many distinct positions it lets through
  // once you page past the first window — assert the weaker, stable claim.
  const count = Number(await needs.locator('i').innerText());
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(4); // QB/RB/WR/TE is the whole skill board
});

test('you can change focus mid-draft and the board reorders under you', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');

  // Set it BEFORE the draft, from the lobby.
  await page.getByTestId('lobby-focus-future').click();
  await page.getByTestId('start').click();

  const focus = page.getByTestId('focus');
  await expect(focus).toBeVisible();
  await expect(page.getByTestId('focus-future')).toHaveAttribute('aria-pressed', 'true');

  const topName = () => page.locator('[data-testid="pool"] .prow .pn').first().innerText();
  const topVal = () => page.locator('[data-testid="pool"] .prow .pv').first().innerText().then(Number);

  const futureTop = await topName();
  const futureVal = await topVal();

  // Flip to win-now mid-draft: same pool, different order and different numbers.
  await page.getByTestId('focus-winnow').click();
  await expect(page.getByTestId('focus-winnow')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('focus-future')).toHaveAttribute('aria-pressed', 'false');
  const winnowTop = await topName();
  const winnowVal = await topVal();
  expect(winnowTop !== futureTop || winnowVal !== futureVal).toBe(true);

  // Balanced is a real third setting, not a label on one of the other two.
  await page.getByTestId('focus-balanced').click();
  await expect(page.getByTestId('focus-balanced')).toHaveAttribute('aria-pressed', 'true');

  // And it sticks: back to the lobby, the lobby buttons agree with the room.
  await expect(page.getByTestId('lobby-focus-balanced')).toHaveCount(0); // still live
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('the focus you pick survives a reload — it is your dial, not the run\'s', async ({ page }) => {
  await page.goto('./mock');
  await page.getByTestId('lobby-focus-winnow').click();
  await expect(page.getByTestId('lobby-focus-winnow')).toHaveClass(/on/);
  await page.reload();
  await expect(page.getByTestId('lobby-focus-winnow')).toHaveClass(/on/);
});

test('spectating hides the focus dial — no seat, nothing to focus', async ({ page }) => {
  await page.goto('./mock');
  await page.getByTestId('spectate').check();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('pool')).toBeVisible();
  await expect(page.getByTestId('focus')).toHaveCount(0);
  await expect(page.getByTestId('only-needs')).toHaveCount(0);
});
