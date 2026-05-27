const { test, expect } = require('@playwright/test');

test.describe('MSN Personalization - Follow Publications', () => {
  test('Test execution', async ({ page }) => {
    // Step 1: Navigate to https://www.msn.com/en-in
    await page.goto('https://www.msn.com/en-in', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'reports/screenshots/step1.png' });

    // Step 2: Wait for the page to fully load and network to stabilize
    const navBar = page.locator('[role="navigation"]').first();
    await navBar.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: 'reports/screenshots/step2.png' });

    // Step 3: Click on 'Personalize'
    const personalizeBtn = page.getByRole('button', { name: /personalize/i }).first();
    await personalizeBtn.waitFor({ state: 'visible', timeout: 10000 });
    await personalizeBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'reports/screenshots/step3.png' });

    // Step 4: Wait for personalize dialog/panel
    const searchBox = page.locator('input#discover-search-box').first();
    await searchBox.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: 'reports/screenshots/step4.png' });

    // Step 5: Focus on the search field
    await searchBox.focus();
    await page.screenshot({ path: 'reports/screenshots/step5.png' });

    // Step 6: Type 'The Times Of India' into the search field
    await searchBox.fill('The Times Of India');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/step6.png' });

    // Step 7: Press Enter to search
    await searchBox.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'reports/screenshots/step7.png' });

    // Step 8: Wait for the search results to load
    const searchResults = page.locator('[aria-label*="Follow The Times of India"]').first();
    await searchResults.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: 'reports/screenshots/step8.png' });

    // Step 9: Click the '+'(Follow) for 'The Times Of India'
    const followTOI = page.locator('[aria-label*="Follow The Times of India"]').first();
    await followTOI.waitFor({ state: 'visible', timeout: 10000 });
    await followTOI.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'reports/screenshots/step9.png' });

    // Step 10: Clear the search field
    await searchBox.clear();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'reports/screenshots/step10.png' });

    // Step 11: Type 'India Today' into the search field
    await searchBox.fill('India Today');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/step11.png' });

    // Step 12: Press Enter to search
    await searchBox.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'reports/screenshots/step12.png' });

    // Step 13: Wait for the search results to load
    const indiaResultsContainer = page.locator('[aria-label*="Follow India Today"]').first();
    await indiaResultsContainer.waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: 'reports/screenshots/step13.png' });

    // Step 14: Click the '+'(Follow) for 'India Today'
    const followIndiaToday = page.locator('[aria-label*="Follow India Today"]').first();
    await followIndiaToday.waitFor({ state: 'visible', timeout: 10000 });
    await followIndiaToday.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'reports/screenshots/step14.png' });

    // Step 15: Close the personalize dialog
    const closeBtn = page.locator('#close-button, fluent-button#close-button').first();
    await closeBtn.waitFor({ state: 'visible', timeout: 10000 });
    await closeBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'reports/screenshots/step15.png' });

    // Verify personalization panel is closed
    const panelClosed = page.locator('input#discover-search-box').first();
    await expect(panelClosed).not.toBeVisible({ timeout: 5000 });
  });
});