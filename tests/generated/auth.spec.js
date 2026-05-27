const { test, expect } = require('@playwright/test');

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://www.msn.com/en-in/weather', { waitUntil: 'domcontentloaded' });
  });

  test('search and open Mumbai weather', async ({ page }) => {
    const screenshotsDir = 'reports/screenshots/';

    const searchInput = page.getByPlaceholder(/location/i).first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: `${screenshotsDir}step1.png` });

    await searchInput.fill('Mumbai');
    await page.screenshot({ path: `${screenshotsDir}step2.png` });

    await searchInput.focus();
    const suggestion = page.getByText(/Mumbai, Maharashtra/i).first();
    await suggestion.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: `${screenshotsDir}step3.png` });

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.screenshot({ path: `${screenshotsDir}step4.png` });

    const headingLocator = page.getByRole('heading', { level: 1, name: /Mumbai/i }).first();
    await headingLocator.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: `${screenshotsDir}step5.png` });

    await expect(headingLocator).toContainText(/Mumbai/i);
    await page.screenshot({ path: `${screenshotsDir}step6.png` });

    const currentCard = page.locator('#weatherContainerButton').first();
    await currentCard.waitFor({ state: 'visible', timeout: 15000 });
    await expect(currentCard).toBeVisible();
    await page.screenshot({ path: `${screenshotsDir}step7.png` });

    await page.screenshot({ path: `${screenshotsDir}step8.png` });
  });
});