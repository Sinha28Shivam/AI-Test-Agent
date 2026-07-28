import { test, expect } from '@playwright/test';

test('MSN Search Test - Search for "Technology"', async ({ page }) => {
  // Step 1: Navigate to the MSN homepage
  await page.goto('https://www.msn.com/en-in');

  // Assert the page URL and title
  await expect(page).toHaveURL('https://www.msn.com/en-in');
  await expect(page).toHaveTitle(/MSN \| Personalized News, Top Headlines, Live Updates and more/i);

  // Step 2: Enter "Technology" in the search box and execute the search
  const searchBox = page.locator('[aria-label="Enter your search term"]'); // Updated selector
  await searchBox.click();
  await searchBox.fill('Technology');
  await searchBox.press('Enter');

  // Assert that search results are displayed
  const searchResults = page.locator('a');
  await searchResults.first().waitFor({ state: 'attached', timeout: 30000 });
  expect(await searchResults.count()).toBeGreaterThan(5);

  // Step 3: Take a screenshot of the search results
  await page.screenshot({
    path: 'test-results/Performance_Testing/msn/search/search_results_technology.png',
    timeout: 5000,
  });
});