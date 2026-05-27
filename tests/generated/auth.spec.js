const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('MSN Money search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://www.msn.com/en-in/money', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Market Brief/i })).toBeVisible({ timeout: 15000 });
    fs.mkdirSync(path.join('reports', 'screenshots'), { recursive: true });
    await page.screenshot({ path: path.join('reports', 'screenshots', 'step1.png'), fullPage: true });
  });

  test('searches for Nifty and shows matching results', async ({ page }) => {
    const stockSearch = page.getByPlaceholder(/Search stocks, ETFs, & more/i).first();
    await stockSearch.waitFor({ state: 'visible', timeout: 15000 });
    await expect(stockSearch).toBeEnabled();
    await page.screenshot({ path: path.join('reports', 'screenshots', 'step2.png'), fullPage: true });

    await stockSearch.fill('Nifty');
    await page.screenshot({ path: path.join('reports', 'screenshots', 'step3.png'), fullPage: true });

    await stockSearch.press('Enter');
    await page.screenshot({ path: path.join('reports', 'screenshots', 'step4.png'), fullPage: true });

    const niftyResult = page.getByText(/Nifty/i).first();
    await niftyResult.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: path.join('reports', 'screenshots', 'step5.png'), fullPage: true });

    await expect(niftyResult).toBeVisible();
  });
});