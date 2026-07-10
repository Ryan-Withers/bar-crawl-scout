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
  // Bots simmed to your pick automatically; you're on the clock.
  await expect(page.getByText(/YOU'RE ON THE CLOCK/i)).toBeVisible();

  // Make a manual pick (top of the list).
  await page.getByRole('button', { name: 'PICK', exact: true }).first().click();
  // Bots roll on to your next turn.
  await expect(page.getByText(/YOU'RE ON THE CLOCK/i)).toBeVisible();

  // Autopick once, then finish the whole thing.
  await page.getByRole('button', { name: /autopick/i }).click();
  await page.getByRole('button', { name: /sim to end/i }).click();

  await expect(page.getByText(/Mock complete/i)).toBeVisible();
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
  await expect(page.getByText(/Mock complete/i)).toBeVisible();
  await expect(page.getByText(/Draft grades/i)).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('mock history persists a finished draft', async ({ page }) => {
  await page.goto('./mock');
  await page.getByText(/Spectate — sim all 10/i).click();
  await page.getByRole('button', { name: /start the mock/i }).click();
  await page.getByRole('button', { name: /sim to end/i }).click();
  await expect(page.getByText(/Mock complete/i)).toBeVisible();
  await page.getByRole('button', { name: /new setup/i }).click();
  await expect(page.getByText(/Past mocks/i)).toBeVisible();
});

test('phone: the war room fits a 390px screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await mockSleeper(page);
  await page.goto('./mock');
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `war room overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  await ctx.close();
});
