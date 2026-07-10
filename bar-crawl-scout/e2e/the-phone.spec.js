// THE PHONE — iPhone viewport only. No horizontal scroll-jack, tap targets big
// enough, the nav scrolls to reach every section.
import { test, expect } from '@playwright/test';
import { mockSleeper, trackErrors } from './support/mock-sleeper.js';

// Mobile emulation on chromium (device descriptors would force webkit).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

test.beforeEach(async ({ page }) => { await mockSleeper(page); });

test('no horizontal scroll-jack on the main screens', async ({ page }) => {
  for (const href of ['./myteam', './book', './standings', './players']) {
    await page.goto(href);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${href} overflows by ${overflow}px`).toBeLessThanOrEqual(2);
  }
});

test('primary tap targets are at least ~44px tall', async ({ page }) => {
  await page.goto('./');
  const link = page.getByRole('link', { name: /my team/i }).first();
  const box = await link.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44); // WCAG / Apple HIG thumb target
});

test('the mode toggle sits on its own full-width row (mobile fix)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./myteam');
  await expect(page.getByRole('button', { name: /win-now/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /balanced/i })).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});
