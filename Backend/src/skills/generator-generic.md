You are converting a recorded browser session into a Playwright test script.

DOMAIN: {domain}
SCENARIO: {scenarioType}
TOTAL STEPS: {totalSteps}
COMPLETED: {completed} ({completionReason})

RECORDED BROWSER SESSION:
{stepsDescription}

INSTRUCTIONS:
1. Convert each recorded step into the equivalent Playwright action.
2. Use the same selectors and actions that were executed in the recorded browser session.
3. Add expect() assertions after each significant state change.
4. Use ES Modules: import { test, expect } from '@playwright/test';
5. Wrap all steps in a single test() block.
6. Use process.env for any credential values – NEVER hardcode them.
7. Output ONLY the code in a single ```javascript code block.
8. When asserting the URL using expect(page).toHaveURL(), use a simple partial regex (e.g. /domain\.com\/path/) and NEVER use the end anchor "$" in the regex. Omitting the "$" anchor ensures trailing slashes, hashes (like /#/), and query parameters never fail the assertion.
9. Do not use non-existent assertions like "toHaveCountGreaterThan". To check count bounds, use expect(await locator.count()).toBeGreaterThan(n) or await expect(locator).toHaveCount(n).
10. Save screenshots using page.screenshot({ path: '...' }). The screenshot path MUST be placed under the directory: "{screenshotDir}/" (using descriptive, clear names, e.g. "{screenshotDir}/search_results_page.png"). Always use forward slashes in screenshot paths. Prefer standard viewport screenshots (without fullPage: true) to avoid timeout issues on dynamic pages. Always specify a short timeout of 5000ms for screenshots so that slow-loading web fonts do not cause the entire test to timeout, e.g. `await page.screenshot({ path: '...', timeout: 5000 })`.
11. NEVER guess class names (e.g. '.news-article-selector') or data-automationid attributes (e.g. '[data-automationid="..."]') that were not explicitly proven to exist. Instead, use robust accessibility selectors like page.getByRole(), page.getByText(), or simple HTML tags like page.locator('img') or page.locator('footer').
12. If verifying that images load successfully, DO NOT assert that ALL images on the page have complete === true and naturalWidth > 0, as pages often contain tracking pixels, lazy-loaded images, or ads that do not render. Instead, write lenient assertions – for example, verify that at least one main image is visible and loaded successfully, or filter out tracking pixels/hidden/empty-src images before performing page-wide checks.

═══════════════════════════════════════════════════════════════
ASSERTION RULES — READ CAREFULLY BEFORE WRITING ANY expect():
═══════════════════════════════════════════════════════════════

13. TITLE ASSERTIONS — ALWAYS use regex, NEVER exact strings:
    ✅ CORRECT:  await expect(page).toHaveTitle(/^MSN/);
    ✅ CORRECT:  await expect(page).toHaveTitle(/Welcome to/i);
    ❌ WRONG:    await expect(page).toHaveTitle('MSN | Personalized News, Top Headlines, Live');
    Reason: Website titles change frequently. An exact match breaks on any wording update.

14. TIMING / PERFORMANCE ASSERTIONS — ALWAYS use range bounds, NEVER toBe(). When measuring page load time in the page context, loadEventEnd might be 0 immediately after navigation. Use a fallback like Date.now() if loadEventEnd is not yet populated:
    ✅ CORRECT:  const loadTime = await page.evaluate(() => {
                   const t = window.performance.timing;
                   const end = t.loadEventEnd > 0 ? t.loadEventEnd : Date.now();
                   return end - t.navigationStart;
                 });
                 expect(loadTime).toBeGreaterThan(0);
                 expect(loadTime).toBeLessThan(60000);
    ❌ WRONG:    expect(loadTime).toBe(14446);
    Reason: The exact millisecond from the recording session is a one-time measurement.
            Network speed varies on every run. toBe() on timing ALWAYS fails eventually.

15. COUNT ASSERTIONS — use range bounds when counting dynamic elements. NEVER count elements by assuming a specific layout tag like section or article unless the recorded actions specifically proved its presence:
    ✅ CORRECT:  expect(await page.locator('a').count()).toBeGreaterThan(0);
    ❌ WRONG:    expect(await page.locator('section').count()).toBeGreaterThan(0);
    ❌ WRONG:    expect(await page.locator('section').count()).toBe(0);
    Reason: CMS-driven pages add/remove items dynamically and change layouts frequently. Do not assert that <section> or <article> tags exist unless they are explicitly in the browser session log.
    If the recorded count is 0 (e.g. sectionCount was 0 during the explore session), DO NOT assert `expect(count).toBe(0)` on layout/structural elements like links, buttons, headers, or sections. These elements often hydrate dynamically and might load late on subsequent runs, leading to false failures. Instead, either omit the assertion entirely, or wait for the elements to be attached/hydrated.
    If a recorded action (like a page.evaluate query for sections/articles) in the session log returned an empty array, empty string, or null, it means those elements DO NOT exist on the live page. NEVER write expectations or waits for those non-existent elements, as doing so will guarantee a test timeout or assertion failure.

16. SPA / REACT CONTENT — wait for load state before asserting content:
    ✅ CORRECT:  await page.goto(url, { waitUntil: 'domcontentloaded' });
                 await page.waitForLoadState('load');
                 await page.locator('a').first().waitFor({ state: 'attached', timeout: 30000 });
    ❌ WRONG:    await page.goto(url);
                 await expect(page.locator('main')).toBeVisible();  // may be empty SPA shell
    Reason: React/Angular/Vue pages render content after JS hydration, not at DOMContentLoaded.
            Avoid waiting for 'networkidle' on pages with heavy tracking/telemetry (like MSN) as it will timeout.

17. CONTENT VISIBILITY ON SPAs / SHADOW DOM — avoid page.evaluate with document.body.innerHTML.length if the page uses Web Components / Shadow DOM (as shadow roots are not included in innerHTML). Instead, assert that a key locator (e.g. page.locator('a').first()) is visible.
    ✅ CORRECT:  await expect(page.locator('a').first()).toBeVisible();
    ❌ WRONG:    const len = await page.evaluate(() => document.body.innerHTML.length); // returns small number if elements are inside shadow roots.

18. LOCATORS — avoid structural locators that assume specific HTML tag structure:
    ✅ CORRECT:  page.getByRole('heading')  OR  page.getByText(/News/i)
    ❌ WRONG:    page.locator('body > div > main > section')
    Reason: Any site redesign breaks deeply structural CSS selectors.

19. NEVER use toBe() or toEqual() on any value that was measured during the recording:
    - Page load times, network request durations, pixel dimensions, response sizes, timestamps.
    - These are one-time session measurements, not stable expected values.
    - Always substitute with toBeGreaterThan(lowerBound) + toBeLessThan(upperBound).

20. SCROLL POSITION / PIXEL VALUES — use approximate checks only:
    ✅ CORRECT:  expect(scrollY).toBeGreaterThan(0);
    ❌ WRONG:    expect(scrollY).toBe(342);

21. DYNAMIC TEXT CONTENT — use regex or toContain(), not exact strings:
    ✅ CORRECT:  await expect(element).toContainText(/welcome/i);
    ❌ WRONG:    await expect(element).toHaveText('Welcome back, Shivam!');
    Reason: User-specific or time-specific content changes between sessions.

22. NAVIGATION ASSERTIONS — always add waitForLoadState after clicks that navigate:
    ✅ CORRECT:  await page.click('a[href="/sports"]');
                 await page.waitForLoadState('domcontentloaded');
                 await expect(page).toHaveURL(/\/sports/);

23. DOM LOOKUPS / ELEMENT COUNT — NEVER use page.evaluate() with document.querySelector/querySelectorAll/getElementById/getElementsByTagName to count elements or assert their presence. Playwright locators automatically pierce Shadow DOM and support auto-waiting, whereas document API does not.
    ✅ CORRECT:  const linksCount = await page.locator('a').count();
                 expect(linksCount).toBeGreaterThan(0);
    ❌ WRONG:    const linksCount = await page.evaluate(() => document.querySelectorAll('a').length);

24. SHADOW DOM HYDRATION WAIT — Always wait for key locators (e.g. first link or first article) to become attached or visible before asserting element counts or verifying page content to prevent hydration race conditions. If elements can be hidden (like skip links), wait for state: 'attached'.
    ✅ CORRECT:  await page.locator('a').first().waitFor({ state: 'attached', timeout: 30000 });
                 const linksCount = await page.locator('a').count();
                 expect(linksCount).toBeGreaterThan(0);

25. BRANDING / LOGO ASSERTIONS — Avoid guessing specific logo image selectors or alt texts (like img[alt="MSN"] or img[alt="Microsoft News logo"]) as these are highly fragile. Instead, verify that the page has loaded successfully by asserting that the body is visible and checking that links or main content are attached/present (using Rule 24).
    ✅ CORRECT:  await expect(page.locator('body')).toBeVisible();
                 await page.locator('a').first().waitFor({ state: 'attached', timeout: 30000 });
                 expect(await page.locator('a').count()).toBeGreaterThan(0);
    ❌ WRONG:    await expect(page.locator('img[alt="Microsoft News logo"]')).toBeVisible();

26. CRITICAL SECURITY / CONTEXT RULE:
    NEVER use Node.js modules (like 'fs', 'path', 'require', or process.env) inside `page.evaluate()` or `page.evaluate(({...}) => { ... })` blocks. 
    `page.evaluate()` runs in the browser where Node.js does not exist. 
    If you need to save data (like performance timings, HTML snippets, or snapshots) to a file, first execute `page.evaluate()` to retrieve the raw data, return it to the Node context, and then write it to a file outside the evaluate block using Node fs or fs/promises:
    
    ✅ CORRECT:
    const perfData = await page.evaluate(() => {
      return {
        url: window.location.href,
        timing: window.performance.timing
      };
    });
    // Write file in Node context:
    const fs = require('fs');
    fs.writeFileSync(snapshotPath, JSON.stringify(perfData, null, 2));

    ❌ WRONG:
    await page.evaluate(({ snapshotPath }) => {
      const data = { url: window.location.href };
      const fs = require('fs'); // Throws: require is not defined!
      fs.writeFileSync(snapshotPath, JSON.stringify(data));
    }, { snapshotPath });

27. DYNAMIC ID SELECTORS — NEVER write assertions or locators using CSS selectors with dynamic/random-looking alphanumeric IDs (e.g., `#AA20nFSy`, `#h-content-card-...`, or any ID that looks dynamically generated). Dynamic IDs change on every session/refresh and are guaranteed to fail. Instead, use role locators, text search, or find generic container tag names, or simply check that parent elements or general body elements are visible.
    ✅ CORRECT:  page.locator('button', { hasText: 'Dismiss' })
    ❌ WRONG:    page.locator('#AA20nFSy > .root > .content-card-container > .card-actions-button-container > .card-actions-button')

28. VIEWPORT SIZE ASSERTIONS — Playwright's `expect(page)` does not have a `toHaveViewportSize` matcher. To verify viewport size, query it and assert: `expect(page.viewportSize()).toEqual({ width: 1200, height: 800 })`.
    ✅ CORRECT:  expect(page.viewportSize()).toEqual({ width: 1200, height: 800 });
    ❌ WRONG:    await expect(page).toHaveViewportSize({ width: 1200, height: 800 });

IMPORTANT: The actions above were actually executed against the real browser. Every selector and interaction is proven to work. Translate faithfully, but apply all Assertion and Context Rules above to every expect() and evaluate() you write.
