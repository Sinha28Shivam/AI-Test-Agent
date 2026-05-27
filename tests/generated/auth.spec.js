const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('navigation', () => {
  const url = 'https://www.msn.com/en-in/money';
  test.beforeEach(async ({ page }) => {
    fs.mkdirSync('reports/screenshots', { recursive: true });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'reports/screenshots/step1.png', fullPage: true });
  });

  test('Navigate to Money, search Nifty, and verify results', async ({ page }) => {
    // Step 2: Wait for the money section to load (prefer heading "Market Brief")
    const marketHeading = page.getByRole('heading', { name: /Market Brief/i }).first();
    try {
      await marketHeading.waitFor({ state: 'visible', timeout: 15000 });
    } catch (err) {
      // Fallback: wait for a stable search input if the heading isn't present
      const fallbackHeading = page.getByRole('heading', { name: /latest/i }).first();
      await fallbackHeading.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }
    await page.screenshot({ path: 'reports/screenshots/step2.png', fullPage: true });

    // Step 3: Locate the search box for stock market or news (prefer placeholder)
    let searchInput = page.getByPlaceholder('Search stocks, ETFs, & more').first();
    try {
      await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    } catch (err) {
      // Fallbacks: placeholder "Search the web" or id "#q"
      searchInput = page.getByPlaceholder('Search the web').first();
      try {
        await searchInput.waitFor({ state: 'visible', timeout: 8000 });
      } catch (err2) {
        searchInput = page.locator('#q').first();
        await searchInput.waitFor({ state: 'visible', timeout: 8000 });
      }
    }
    await page.screenshot({ path: 'reports/screenshots/step3.png', fullPage: true });

    // Step 4: Type 'Nifty' into the search input and press Enter
    await searchInput.fill(''); // clear for stability
    await searchInput.fill('Nifty');
    await searchInput.press('Enter');
    await page.screenshot({ path: 'reports/screenshots/step4.png', fullPage: true });

    // Step 5: Wait for search results to load - look for a card or text containing 'Nifty'
    const resultLocator = page.getByText(/Nifty/i).first();
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: 'reports/screenshots/step5.png', fullPage: true });

    // Step 6: Assert that at least one search result or index card containing 'Nifty' is visible
    await expect(resultLocator).toBeVisible();
    await page.screenshot({ path: 'reports/screenshots/step6.png', fullPage: true });
  });
});