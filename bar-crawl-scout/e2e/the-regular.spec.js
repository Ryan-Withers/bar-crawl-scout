// THE REGULAR — the Tuesday visitor. Lands, reads the room, opens the book,
// checks the table. Assert: no dead ends, no uncaught errors, every link lands.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('lands on the hub with the sign lit and the nav present', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page.getByLabel('Bar Crawl Scout')).toBeVisible(); // the neon hero
  // Grouped nav present.
  for (const label of ['My Team', 'The League', 'The Wire', 'The Book']) {
    await expect(page.getByRole('link', { name: new RegExp(label, 'i') }).first()).toBeVisible();
  }
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('opens The Book and sees the sportsbook', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./book');
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
  // Seeded bettor is logged in, so the markets render (not the gate).
  await expect(page.getByText(/season futures/i)).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('reads the standings table', async ({ page }) => {
  await page.goto('./standings');
  // The seeded/fallback table shows the seats.
  await expect(page.getByText(/Buckle Up!/i).first()).toBeVisible();
});

test('clicking nav navigates in-app to a REAL url, and back works', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /the book/i }).first().click();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/book$/);   // real path, no #
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
  await expect(page).toHaveTitle(/The Book/);                  // real page title
  await page.goBack();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/$/);
});

test('legacy #/ links redirect to real urls (old shares keep working)', async ({ page }) => {
  await page.goto('./#/book');
  await expect(page).toHaveURL(/\/bar-crawl-scout\/book$/);
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
});

test('every group-nav link lands on a real page (no dead ends)', async ({ page }) => {
  await page.goto('./');
  const groups = ['./myteam', './board', './standings', './players', './book', './settings'];
  for (const href of groups) {
    await page.goto(href);
    // A router stub page would be near-empty; assert real content height.
    const h = await page.evaluate(() => document.body.scrollHeight);
    expect(h, `page ${href} looks empty`).toBeGreaterThan(400);
  }
});
