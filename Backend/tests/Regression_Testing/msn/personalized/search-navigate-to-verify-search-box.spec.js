import { test, expect } from '@playwright/test';

test('Search on MSN and verify personalized news feed', async ({ page }) => {
  // Step 1: Navigate to the MSN homepage
  await page.goto('https://www.msn.com/en-in');

  // Assert that the page has successfully loaded by checking the title
  await expect(page).toHaveTitle(/MSN \| Personalized News, Top Headlines, Live Updates and more/i);

  // Step 2: Locate the search box
  const searchBox = page.locator('input[aria-label="Enter your search term"]');

  // Assert that the search box exists and is visible
  await expect(searchBox).toBeVisible();

  // Step 3: Dismiss any overlay or banner (e.g., cookie notice or modal)
  const dismissBannerButton = page.locator('button:has-text("Close")'); // Updated selector to match DOM context
  if (await dismissBannerButton.isVisible()) {
    await dismissBannerButton.click();
    await expect(dismissBannerButton).toBeHidden(); // Wait for it to disappear
  }

  // Step 4: Perform a search
  await searchBox.click();
  await searchBox.fill('Playwright Test Query');
  await searchBox.press('Enter');

  // Step 5: Verify search results are displayed
  const firstResultLink = page.locator('a');
  await firstResultLink.first().waitFor({ state: 'visible', timeout: 30000 });
  const linksCount = await page.locator('a').count();
  expect(linksCount).toBeGreaterThan(5);

  // Capture a screenshot of the search results page
  await page.screenshot({ 
    path: 'test-results/Regression_Testing/msn/personalized/search_results_page.png', 
    timeout: 5000 
  });

  // Step 6: Verify that the personalized news feed is loaded
  const personalizedNewsFeed = page.locator('[id*="entry-point-hp-wc-root-wrapper"]'); // Adjusted selector for better accuracy
  const isNewsFeedLoaded = await personalizedNewsFeed.evaluate(
    element => element !== null && element.children.length > 0
  );
  expect(isNewsFeedLoaded).toBeTruthy();

  // Capture a screenshot of the personalized news feed section
  await page.screenshot({ 
    path: 'test-results/Regression_Testing/msn/personalized/personalized_news_feed.png', 
    timeout: 5000 
  });
});