const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const url = 'https://www.msn.com/en-in';
const screenshotsDir = path.join(process.cwd(), 'reports', 'screenshots');

async function captureStep(page, stepNumber) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotsDir, `step${stepNumber}.png`),
    fullPage: true
  });
}

async function clickFirstAvailable(candidates, timeout = 15000) {
  let lastError;
  for (const getLocator of candidates) {
    const locator = getLocator();
    try {
      await locator.waitFor({ state: 'visible', timeout });
      const target = locator.first();
      await expect(target).toBeEnabled({ timeout });
      await target.click();
      return target;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No matching locator found');
}

async function waitForFirstVisible(candidates, timeout = 15000) {
  let lastError;
  for (const getLocator of candidates) {
    const locator = getLocator();
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return locator.first();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No matching visible locator found');
}

test.describe('MSN personalize follow flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder(/search the web/i).first()).toBeVisible({ timeout: 15000 });

    await clickFirstAvailable([
      () => page.getByRole('button', { name: /dismissbanner|close/i }),
      () => page.getByRole('link', { name: /dismissbanner|close/i }),
      () => page.locator('button, a').filter({ hasText: /close|dismiss/i })
    ], 4000).catch(() => null);
  });

  test('opens personalize, follows two sources, and closes the panel', async ({ page }) => {
    test.setTimeout(120000);

    await captureStep(page, 1);

    await clickFirstAvailable([
      () => page.getByRole('button', { name: /personalize/i }),
      () => page.getByRole('link', { name: /personalize/i }),
      () => page.locator('button, a').filter({ hasText: /personalize/i })
    ]);

    const personalizeDialog = await waitForFirstVisible([
      () => page.getByRole('dialog', { name: /personalize/i }),
      () => page.locator('[role="dialog"]').filter({ hasText: /personalize/i }),
      () => page.locator('[role="dialog"]')
    ], 15000);

    await expect(personalizeDialog).toBeVisible({ timeout: 15000 });
    await captureStep(page, 2);

    const searchField = await waitForFirstVisible([
      () => personalizeDialog.getByRole('searchbox', { name: /search/i }),
      () => personalizeDialog.getByPlaceholder(/search/i),
      () => personalizeDialog.locator('input[aria-label*="search" i]'),
      () => personalizeDialog.locator('input[placeholder*="search" i]')
    ], 15000);

    await expect(searchField).toBeVisible({ timeout: 15000 });

    await searchField.fill('The Times Of India');
    await searchField.press('Enter');

    await expect(page.getByText(/The Times of India/i).first()).toBeVisible({ timeout: 15000 });
    await captureStep(page, 3);

    const firstResult = personalizeDialog.locator(
      '[role="option"], [role="listitem"], article, li, section, div'
    ).filter({ hasText: /The Times of India/i }).first();

    const firstFollowButton = firstResult.getByRole('button', { name: /follow|\+/i }).first();
    await firstFollowButton.waitFor({ state: 'visible', timeout: 15000 });
    await expect(firstFollowButton).toBeEnabled({ timeout: 15000 });
    await firstFollowButton.click();

    await expect(firstFollowButton).toHaveAccessibleName(/following|unfollow|remove/i, { timeout: 15000 });
    await captureStep(page, 4);

    await searchField.fill('');
    await captureStep(page, 5);

    await searchField.fill('India Today');
    await searchField.press('Enter');

    await expect(page.getByText(/India Today/i).first()).toBeVisible({ timeout: 15000 });

    const secondResult = personalizeDialog.locator(
      '[role="option"], [role="listitem"], article, li, section, div'
    ).filter({ hasText: /India Today/i }).first();

    const secondFollowButton = secondResult.getByRole('button', { name: /follow|\+/i }).first();
    await secondFollowButton.waitFor({ state: 'visible', timeout: 15000 });
    await expect(secondFollowButton).toBeEnabled({ timeout: 15000 });
    await secondFollowButton.click();

    await expect(secondFollowButton).toHaveAccessibleName(/following|unfollow|remove/i, { timeout: 15000 });
    await captureStep(page, 6);

    await clickFirstAvailable([
      () => personalizeDialog.getByRole('button', { name: /close|dismiss/i }),
      () => personalizeDialog.locator('button, a').filter({ hasText: /close|dismiss/i })
    ]);

    await expect(personalizeDialog).toBeHidden({ timeout: 15000 });
    await captureStep(page, 7);
  });
});