import { test, expect } from '@playwright/test';

test('MSN navigation test', async ({ page }) => {
  // Step 1: Navigate to the MSN domain
  await page.goto('https://www.msn.com/en-in', { waitUntil: 'domcontentloaded' });
  // Assert that the page URL contains the expected domain
  await expect(page).toHaveURL(/www\.msn\.com\/en-in/);
  // Assert that the page title starts with the expected text
  await expect(page).toHaveTitle(/^MSN/);

  // Step 2: Assert that the document title matches the expected pattern
  const pageTitle = await page.title();
  expect(pageTitle).toMatch(/^MSN/);
  
  // Optional title assertion using Playwright's evaluate method for educational purposes
  const documentTitle = await page.evaluate(() => document.title);
  expect(documentTitle).toMatch(/^MSN/);

  // Step 3: Attempt a screenshot save (non-fullPage due to timeout issues)
  try {
    await page.screenshot({
      path: 'test-results/Smoke_Testing/msn/homepage/msn-homepage.png',
      timeout: 5000,
    });
  } catch (e) {
    // Do not throw on screenshot timeout errors, but log them
    console.log('Screenshot attempt failed:', e.message);
  }

  // Step 4: Validation and fallback for element existence
  const sectionCount = await page.locator('section').count(); // replaces unsafe querySelector length(incomplete)
similar footsteps!!


If html script--more"""