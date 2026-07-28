import { test, expect } from '@playwright/test';

test('Recorded browser session - www.msn.com form/interactive inputs', async ({ page }) => {
  // Step 1: Navigate to MSN homepage
  await page.goto('https://www.msn.com/en-in', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(/msn\.com\/en-in/);
  await expect(page).toHaveTitle(/^MSN/);

  // Step 2: Measure page load time
  const loadTime = await page.evaluate(() => {
    const timing = window.performance.timing;
    const end = timing.loadEventEnd > 0 ? timing.loadEventEnd : Date.now();
    return end - timing.navigationStart;
  });
  expect(loadTime).toBeGreaterThan(0);
  expect(loadTime).toBeLessThan(60000);

  // Step 3: Take a screenshot of the page
  await page.screenshot({
    path: 'test-results/Performance_Testing/msn/homepage/msn_homepage_performance.png',
    timeout: 5000,
  });

  // Step 4: Resize the browser viewport
  await page.setViewportSize({ width: 1200, height: 800 });
  const viewport = page.viewportSize();
  expect(viewport).toEqual({ width: 1200, height: 800 });
});