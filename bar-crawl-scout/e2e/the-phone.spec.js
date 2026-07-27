// THE PHONE — iPhone viewport only. No horizontal scroll-jack, thumb-sized tap
// targets, and the whole app reachable without a mouse.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

// Mobile emulation on chromium (device descriptors would force webkit).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('no horizontal scroll-jack on the main screens', async ({ page }) => {
  for (const href of ['./', './myteam', './book', './standings', './players', './managers']) {
    await page.goto(href);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${href} overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  }
});

test('the bottom tab bar is present and thumb-sized', async ({ page }) => {
  await page.goto('./');
  const tabbar = page.getByTestId('tabbar');
  await expect(tabbar).toBeVisible();
  const myTeam = tabbar.getByRole('link', { name: /my team/i });
  const box = await myTeam.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44); // WCAG / Apple HIG thumb target
  await myTeam.click();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/myteam$/);
});

test('the drawer reveals every section WITH a description of each page', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('tab-more').click();
  const drawer = page.getByTestId('drawer');
  await expect(drawer).toBeVisible();
  // Touch has no hover, so descriptions are simply always visible here.
  await expect(drawer.getByText(/practice draft/i)).toBeVisible();
  await expect(drawer.getByText('Free Agents', { exact: true })).toBeVisible();
  // And tapping one navigates, closing the drawer behind you.
  await drawer.getByTestId('nav-standings').click();
  await expect(page).toHaveURL(/\/bar-crawl-scout\/standings$/);
  await expect(drawer).toHaveCount(0);
});

test('the sidebar is hidden on a phone (the tab bar replaces it)', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('sidebar')).toBeHidden();
});

test('the window-mode toggle still works on valuation pages', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./myteam');
  await expect(page.getByRole('button', { name: /win-now/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /balanced/i })).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});
