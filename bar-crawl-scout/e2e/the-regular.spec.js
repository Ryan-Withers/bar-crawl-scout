// THE REGULAR — the Tuesday visitor. Lands on the home dashboard, understands
// what the app does, opens a section, checks the table. Assert: no dead ends,
// no uncaught errors, every destination lands on real content.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('home explains the app and every section is reachable from the sidebar', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page.getByLabel('Bar Crawl Scout')).toBeVisible(); // the neon hero

  // The plain-English promise, not jargon.
  await expect(page.getByText(/headquarters/i)).toBeVisible();
  await expect(page.getByText(/Everything in here/i)).toBeVisible();

  // Sidebar carries every section, in plain language.
  const sidebar = page.getByTestId('sidebar');
  for (const label of ['My Team', 'Draft Room', 'The League', 'Waiver Wire', 'Side Bets']) {
    await expect(sidebar.getByText(label, { exact: true }).first()).toBeVisible();
  }
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('a newcomer can see what a page does before clicking it', async ({ page }) => {
  await page.goto('./');
  // Home cards spell out every tool.
  const card = page.getByTestId('card-mock');
  await expect(card).toContainText(/practice draft/i);
  await card.click();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/mock$/);
});

test('opens the sportsbook and sees the markets', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./book');
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
  // Scope to the page body: the nav flyout and the page lede also say "season futures".
  await expect(page.getByTestId('content').getByText(/season futures/i)).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('reads the standings table', async ({ page }) => {
  await page.goto('./standings');
  await expect(page.getByText(/Buckle Up!/i).first()).toBeVisible();
});

test('clicking the nav navigates in-app to a REAL url, and back works', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('nav-book').click();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/book$/);   // real path, no #
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
  await expect(page).toHaveTitle(/Markets/);                   // real page title
  await page.goBack();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/$/);
});

test('the shell names the page and describes it', async ({ page }) => {
  await page.goto('./myteam');
  await expect(page.getByRole('heading', { name: 'Lineup', level: 1 })).toBeVisible();
  await expect(page.getByTestId('page-lede')).toContainText(/starting side/i);
});

test('legacy #/ links redirect to real urls (old shares keep working)', async ({ page }) => {
  await page.goto('./#/book');
  await expect(page).toHaveURL(/\/bar-crawl-scout\/book$/);
  await expect(page.getByText(/DINGER/i).first()).toBeVisible();
});

test('every destination lands on a real page (no dead ends)', async ({ page }) => {
  const routes = ['./myteam', './board', './standings', './players', './book', './settings', './managers', './history'];
  for (const href of routes) {
    await page.goto(href);
    // A router stub page would be near-empty; assert real content height.
    const h = await page.evaluate(() => document.body.scrollHeight);
    expect(h, `page ${href} looks empty`).toBeGreaterThan(400);
  }
});
