const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('MSN Personalize Follow Flow', () => {
  const screenshotDir = path.join('reports', 'screenshots');

  test.beforeEach(async ({ page }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });
    page.setDefaultTimeout(30000);
  });

  test('should personalize and follow requested publishers', async ({ page }, testInfo) => {
    let step = 1;

    const captureStep = async () => {
      const filePath = path.join(screenshotDir, `step${step}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      await testInfo.attach(`step${step}`, { path: filePath, contentType: 'image/png' });
      step += 1;
    };

    const personalizeTrigger = page
      .locator('#myInterests, button:has-text("Personalize"), a:has-text("Personalize")')
      .first();

    const searchInput = page.locator('input#discover-search-box').first();
    const closeButton = page.locator('#close-button, fluent-button#close-button').first();

    const followLocator = (publisher) =>
      page
        .locator(
          `[aria-label="Follow ${publisher}"], [aria-label*="Follow ${publisher}" i], [aria-label*="${publisher}" i][aria-label*="Follow" i]`
        )
        .first();

    const followedStateLocator = (publisher) =>
      page
        .locator(
          `[aria-label*="Unfollow" i][aria-label*="${publisher}" i], [aria-label*="Following" i][aria-label*="${publisher}" i], [aria-pressed="true"][aria-label*="${publisher}" i]`
        )
        .first();

    await page.goto('https://www.msn.com/en-in', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/msn\.com\/en-in/i);
    await captureStep();

    await personalizeTrigger.waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('#q').first()).toBeVisible({ timeout: 15000 });
    await captureStep();

    await expect(personalizeTrigger).toBeEnabled();
    await personalizeTrigger.click();
    await captureStep();

    await searchInput.waitFor({ state: 'visible', timeout: 20000 });
    await expect(closeButton).toBeVisible({ timeout: 15000 });
    await captureStep();

    await searchInput.click();
    await expect(searchInput).toBeFocused();
    await captureStep();

    await searchInput.fill('The Times Of India');
    await expect(searchInput).toHaveValue('The Times Of India');
    await captureStep();

    await page.keyboard.press('Enter');
    await captureStep();

    const toiFollow = followLocator('The Times Of India');
    await toiFollow.waitFor({ state: 'visible', timeout: 20000 });
    await captureStep();

    await expect(toiFollow).toBeEnabled();
    await toiFollow.click();
    await Promise.any([
      expect(toiFollow).toHaveAttribute('aria-label', /unfollow|following/i, { timeout: 15000 }),
      expect(followedStateLocator('The Times Of India')).toBeVisible({ timeout: 15000 })
    ]);
    await captureStep();

    await searchInput.fill('');
    await expect(searchInput).toHaveValue('');
    await captureStep();

    await searchInput.fill('India Today');
    await expect(searchInput).toHaveValue('India Today');
    await captureStep();

    await page.keyboard.press('Enter');
    await captureStep();

    const itFollow = followLocator('India Today');
    await itFollow.waitFor({ state: 'visible', timeout: 20000 });
    await captureStep();

    await expect(itFollow).toBeEnabled();
    await itFollow.click();
    await Promise.any([
      expect(itFollow).toHaveAttribute('aria-label', /unfollow|following/i, { timeout: 15000 }),
      expect(followedStateLocator('India Today')).toBeVisible({ timeout: 15000 })
    ]);
    await captureStep();

    await expect(closeButton).toBeEnabled();
    await closeButton.click();
    await expect(searchInput).toBeHidden({ timeout: 15000 });
    await captureStep();
  });
});