// THE WAR ROOM — mock draft E2E: the full loop a mate will actually run.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('full mock: setup -> sim to my pick -> pick -> sim to end -> grades', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');
  await expect(page.getByText(/THE WAR ROOM/i)).toBeVisible();
  await expect(page).toHaveTitle(/War Room/);
  // The hub chrome is hidden — this is its own room.
  await expect(page.getByRole('link', { name: /the league/i })).toHaveCount(0);

  // Personas render with sliders (2 per team = 20).
  await expect(page.locator('input[type=range]')).toHaveCount(20);

  await page.getByRole('button', { name: /start the mock/i }).click();
  // Bots TICK to your pick one by one (not an instant jump); you're on the clock.
  await expect(page.getByText(/YOU'RE ON THE CLOCK/i)).toBeVisible({ timeout: 10_000 });

  // The wall board renders: slots across, rounds down, your cell highlighted.
  await expect(page.locator('.dboard')).toBeVisible();
  await expect(page.locator('.dcell.cur')).toHaveCount(1);

  // Make a manual pick (top of the list); bots tick on to your next turn.
  await page.getByRole('button', { name: 'PICK', exact: true }).first().click();
  await expect(page.getByText(/YOU'RE ON THE CLOCK/i)).toBeVisible({ timeout: 10_000 });
  // Picks appear on the wall board. Checked AFTER the manual pick: the shuffled
  // order can seat you 1st overall, in which case the board is legally empty at
  // your first turn (that exact flake failed CI run 133 twice).
  await expect(page.locator('.dpk').first()).toBeVisible();

  // Autopick once, then finish the whole thing (accelerating tick-through).
  await page.getByRole('button', { name: /autopick/i }).click();
  await page.getByRole('button', { name: /sim to end/i }).click({ timeout: 10_000 });

  await expect(page.getByText(/Mock complete/i)).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText(/Draft grades/i)).toBeVisible();
  await expect(page.getByText(/A\+/).first()).toBeVisible();
  await expect(page.getByText(/The full board/i)).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('spectate mode sims all ten and lands on grades', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./mock');
  await page.getByText(/Spectate — sim all 10/i).click();
  await page.getByRole('button', { name: /start the mock/i }).click();
  await page.getByRole('button', { name: /sim to end/i }).click();
  await expect(page.getByText(/Mock complete/i)).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText(/Draft grades/i)).toBeVisible();
  // The finished wall board shows in the debrief too.
  await expect(page.locator('.dboard')).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('mock history persists a finished draft', async ({ page }) => {
  await page.goto('./mock');
  await page.getByText(/Spectate — sim all 10/i).click();
  await page.getByRole('button', { name: /start the mock/i }).click();
  await page.getByRole('button', { name: /sim to end/i }).click();
  await expect(page.getByText(/Mock complete/i)).toBeVisible({ timeout: 25_000 });
  await page.getByRole('button', { name: /new setup/i }).click();
  await expect(page.getByText(/Past mocks/i)).toBeVisible();
});

test('real board mode: Sleeper slots + a traded pick put Ryan on the clock at 1.02 AND 1.04', async ({ page }) => {
  const errors = trackErrors(page);
  // A full 10-team league so the real slot board resolves. Slot i = handle i.
  const HANDLES = ['ImyHunter', 'Ryan', 'ShaydenB', 'JShrimp341', 'ATorelli4', 'jpdonners', 'WinzTheBrah', 'joshleota', 'JohnnyDuff', 'jduddy9'];
  const users = HANDLES.map((h, i) => ({ user_id: String(i + 1), display_name: h === 'Ryan' ? 'witherssssss' : h }));
  const rosters = HANDLES.map((_, i) => ({ roster_id: i + 1, owner_id: String(i + 1), players: [], starters: [], settings: {} }));
  const draft_order = Object.fromEntries(users.map((u, i) => [u.user_id, i + 1]));
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  // Registered AFTER mockSleeper's catch-all, so these win (Playwright matches newest-first).
  await page.route(/api\.sleeper\.app.*\/users$/, (r) => json(r, users));
  await page.route(/api\.sleeper\.app.*\/rosters$/, (r) => json(r, rosters));
  await page.route(/api\.sleeper\.app.*\/drafts$/, (r) => json(r, [{ draft_id: 'd1', season: '2026', type: 'snake', status: 'pre_draft', draft_order }]));
  // JShrimp341 (slot 4) traded that pick to Ryan (roster 2) -> Ryan owns 1.02 and 1.04.
  await page.route(/api\.sleeper\.app.*\/traded_picks$/, (r) => json(r, [{ season: '2026', round: 1, roster_id: 4, owner_id: 2, previous_owner_id: 4 }]));

  await page.goto('./mock');
  await expect(page.getByRole('button', { name: /real board/i })).toBeVisible();
  await expect(page.getByText(/1 traded pick honored/i)).toBeVisible();
  await expect(page.getByText(/via Shakir and Baker Baby/i)).toBeVisible(); // slot 4, rerouted to Ryan

  await page.getByRole('button', { name: /start the mock/i }).click();
  const clock = page.locator('.clockbar');
  await expect(clock).toContainText(/YOU'RE ON THE CLOCK/i, { timeout: 10_000 });
  await expect(clock).toContainText('pick 2');
  await page.getByRole('button', { name: 'PICK', exact: true }).first().click();
  // One bot ticks at 1.03, then Ryan is straight back up at 1.04.
  await expect(clock).toContainText(/YOU'RE ON THE CLOCK/i, { timeout: 10_000 });
  await expect(clock).toContainText('pick 4');
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('copy for the group chat puts the recap on the clipboard', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await mockSleeper(page);
  await page.goto('./mock');
  await page.getByText(/Spectate — sim all 10/i).click();
  await page.getByRole('button', { name: /start the mock/i }).click();
  await page.getByRole('button', { name: /sim to end/i }).click();
  await expect(page.getByText(/Mock complete/i)).toBeVisible({ timeout: 25_000 });

  await page.getByRole('button', { name: /copy for the group chat/i }).click();
  await expect(page.getByText(/copied — go stir the pot/i)).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('🏈 THE WAR ROOM — mock draft');
  expect(text).toContain('🥇');
  expect(text, 'spectate recap has no personal haul').not.toContain('MY HAUL');
  expect(text).toContain('Run yours: https://ryan-withers.github.io/bar-crawl-scout/mock');
  await ctx.close();
});

test('the pick clock counts down and auto-picks at zero', async ({ page }) => {
  const errors = trackErrors(page);
  // 3-second clock seeded directly so the test doesn't wait out a real 30s timer.
  await page.addInitScript(() => localStorage.setItem('bcs_mock_clock', '3'));
  await page.goto('./mock');
  await page.getByRole('button', { name: /start the mock/i }).click();
  await expect(page.getByText(/YOU'RE ON THE CLOCK/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.pickclock')).toBeVisible();
  await expect(page.locator('.pickclock')).toHaveText(/0:0[0-3]/);

  // Don't touch anything: the clock expires and the room picks for you.
  // (Roster growth is the proof — the clockbar may never blink out when the
  // seat has back-to-back picks at a snake turnaround.)
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll('.sidepane .mine .lrow').length), { timeout: 10_000 })
    .toBeGreaterThan(3); // 3 keepers + at least the auto-picked player
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('setup remembers the pick clock and disables it for spectate', async ({ page }) => {
  await page.goto('./mock');
  await page.getByRole('button', { name: '60s', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '60s', exact: true })).toHaveClass(/on/);
  await page.getByText(/Spectate — sim all 10/i).click();
  await expect(page.getByRole('button', { name: '60s', exact: true })).toBeDisabled();
});

for (const width of [320, 390, 430]) {
  test(`phone ${width}px: setup and live both fit, and PICK is thumb-sized`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await mockSleeper(page);
    await page.goto('./mock');
    await page.waitForTimeout(400);
    const over1 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over1, `setup overflows by ${over1}px`).toBeLessThanOrEqual(2);

    await page.getByRole('button', { name: /start the mock/i }).click();
    await expect(page.getByText(/YOU'RE ON THE CLOCK/i)).toBeVisible({ timeout: 10_000 });
    const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over2, `live board overflows by ${over2}px`).toBeLessThanOrEqual(2);

    // Tap targets: the PICK button must be comfortably thumbable on a phone.
    const box = await page.getByRole('button', { name: 'PICK', exact: true }).first().boundingBox();
    expect(box.height, `PICK is only ${box?.height}px tall`).toBeGreaterThanOrEqual(38);
    await ctx.close();
  });
}
