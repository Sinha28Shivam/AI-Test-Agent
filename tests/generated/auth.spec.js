const { test, expect } = require('@playwright/test');

test.describe('Example Domain Page Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  });

  test('Verify page loads with expected content', async ({ page }) => {
    // Verify h1 heading is visible and contains expected text
    const heading = page.getByRole('heading', { level: 1 });
    await heading.waitFor({ state: 'visible', timeout: 15000 });
    await expect(heading).toContainText('Example Domain');
    
    await page.screenshot({ path: 'reports/screenshots/step1.png' });

    // Verify link is visible and contains expected text
    const link = page.getByRole('link', { name: /Learn more/i });
    await link.waitFor({ state: 'visible', timeout: 15000 });
    await expect(link).toContainText('Learn more');
    
    await page.screenshot({ path: 'reports/screenshots/step2.png' });
  });
});