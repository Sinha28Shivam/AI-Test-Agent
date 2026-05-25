/**
 * Scenario Strategy Definitions
 * Each scenario type carries its own "thinking" — telling downstream agents
 * what DOM elements to prioritize, what code to generate, what to validate,
 * and what failure causes to expect.
 */

export interface ScenarioStrategy {
  type: string;
  description: string;

  dom: {
    prioritySelectors: string[];  // CSS selectors to surface first in DOM snapshot
    contextHint: string;           // human-readable hint passed to the generator
  };

  generation: {
    focus: string;                 // one-line description of what to generate
    requiredActions: string[];     // Playwright actions that MUST appear in generated code
    promptHints: string[];         // extra instructions injected into the AI prompt
  };

  validation: {
    requiredPatterns: Array<{ pattern: RegExp; description: string }>;
    scoringBonus: number;          // added to overallAccuracy if all patterns found
  };

  analysis: {
    commonFailureCauses: string[];
    fixSuggestions: string[];
  };
}

export const SCENARIO_STRATEGIES: Record<string, ScenarioStrategy> = {

  authentication: {
    type: "authentication",
    description: "User login / sign-in flow",
    dom: {
      prioritySelectors: [
        'input[type="password"]',
        'input[type="email"]',
        'input[type="text"]',
        'button[type="submit"]',
        'form',
      ],
      contextHint:
        "Login scenario: locate email/username field, password field, submit button. " +
        "Assert post-login URL change or welcome message.",
    },
    generation: {
      focus:
        "Fill login credentials, submit the form, assert post-login state (URL or success message)",
      requiredActions: ["fill", "click"],
      promptHints: [
        "Always fill both username/email AND password fields",
        "Click the submit/login button after filling",
        "Assert the post-login URL or a success/welcome element",
        "Handle login-error messages (wrong credentials banner) gracefully",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.fill\s*\(/, description: "credential fill action" },
        { pattern: /password/i, description: "password field interaction" },
        {
          pattern: /toHaveURL|toContainText|toBeVisible/,
          description: "post-login assertion",
        },
      ],
      scoringBonus: 2,
    },
    analysis: {
      commonFailureCauses: [
        "Login form selector mismatch — form may have changed",
        "Test account credentials invalid or account locked",
        "Post-login redirect URL does not match assertion",
        "CAPTCHA / bot-detection blocking automated login",
      ],
      fixSuggestions: [
        'Use getByRole("textbox", { name: /email/i }) instead of CSS selectors',
        "Verify the login form is visible before filling",
        "Assert URL with a regex pattern instead of exact string",
      ],
    },
  },

  registration: {
    type: "registration",
    description: "User signup / account creation flow",
    dom: {
      prioritySelectors: [
        'input[type="email"]',
        'input[type="password"]',
        'input[type="text"]',
        'button[type="submit"]',
        "form",
      ],
      contextHint:
        "Registration scenario: fill all signup form fields (name, email, password, confirm), " +
        "submit, assert confirmation or redirect.",
    },
    generation: {
      focus:
        "Fill all required registration fields, submit, verify success message or redirect",
      requiredActions: ["fill", "click"],
      promptHints: [
        "Fill every required field — name, email, password, confirm-password",
        "Use unique test data to avoid duplicate-registration errors",
        "Submit the form and assert a success message or page redirect",
        "Check for field-level validation errors after submit",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.fill\s*\(/, description: "form field fill" },
        {
          pattern: /toBeVisible|toContainText|toHaveURL/,
          description: "registration result assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Required field not found by selector",
        "Server-side validation rejecting test data",
        "Duplicate email from previous test run",
      ],
      fixSuggestions: [
        "Use getByLabel() to find form fields by their label text",
        "Generate unique email with timestamp: user+${Date.now()}@test.com",
        "Assert field validation messages to understand which field failed",
      ],
    },
  },

  "password-recovery": {
    type: "password-recovery",
    description: "Forgot-password / reset-password flow",
    dom: {
      prioritySelectors: [
        'a[href*="forgot"]',
        'a[href*="reset"]',
        'input[type="email"]',
        'button[type="submit"]',
      ],
      contextHint:
        "Password recovery scenario: find the forgot-password link, submit email, " +
        "assert confirmation message.",
    },
    generation: {
      focus:
        "Click forgot-password link, fill email, submit, verify confirmation message",
      requiredActions: ["click", "fill"],
      promptHints: [
        "Click the forgot/reset password link on the login page",
        "Fill the email field on the recovery form",
        "Submit and assert a confirmation or check-your-email message",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.fill\s*\(/, description: "email fill action" },
        {
          pattern: /toBeVisible|toContainText/,
          description: "recovery confirmation assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Forgot-password link not found on the page",
        "Recovery form not loading after click",
        "Confirmation message text changed",
      ],
      fixSuggestions: [
        'Use getByText(/forgot/i) or getByRole("link") to find the link',
        "Wait for the recovery form to be visible before filling",
      ],
    },
  },

  "search-functionality": {
    type: "search-functionality",
    description: "Search input, submission, and results verification",
    dom: {
      prioritySelectors: [
        'input[type="search"]',
        '[role="searchbox"]',
        'input[name="q"]',
        'input[name="search"]',
        'input[placeholder*="search" i]',
      ],
      contextHint:
        "Search scenario: find the search box, type a query, submit (Enter or button), " +
        "assert results container is visible.",
    },
    generation: {
      focus:
        "Type a search query, submit, assert that results appear",
      requiredActions: ["fill", "press"],
      promptHints: [
        'Locate the search input using getByRole("searchbox") or getByPlaceholder(/search/i)',
        "Type a realistic query that should always return results",
        "Submit with page.keyboard.press('Enter') or click the search button",
        "Assert the results container or at least one result item is visible",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.fill\s*\(/, description: "search query fill" },
        { pattern: /press|Enter|keyboard/, description: "search submission" },
        {
          pattern: /toBeVisible|toContainText/,
          description: "results assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Search input selector mismatch — element may use a non-standard role",
        "Results take longer to load than the assertion timeout allows",
        "Test query returns zero results on this environment",
      ],
      fixSuggestions: [
        "Use getByPlaceholder for the search input as a stable fallback",
        "Add waitForResponse or waitForSelector on the results container",
        "Use a generic, always-valid search term (e.g. 'a' or 'the')",
      ],
    },
  },

  navigation: {
    type: "navigation",
    description: "Clicking navigation links and verifying route changes",
    dom: {
      prioritySelectors: [
        "nav a",
        '[role="navigation"] a',
        "header a",
        '[role="menuitem"]',
        'a[href]',
      ],
      contextHint:
        "Navigation scenario: click nav links or menu items, verify URL changes " +
        "and destination page content loads.",
    },
    generation: {
      focus:
        "Click navigation elements, assert URL change and destination page content",
      requiredActions: ["click"],
      promptHints: [
        'Use getByRole("link") or getByRole("menuitem") to locate nav elements',
        "After each click, assert the URL with page.waitForURL() or expect(page).toHaveURL()",
        "Verify the destination page heading or key content is visible",
        "Handle SPA routing — use waitForLoadState after navigation",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.click\s*\(/, description: "navigation click" },
        {
          pattern: /toHaveURL|waitForURL|toContainText/,
          description: "destination page assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Navigation link not found or text changed",
        "SPA routing not detected — URL assertion fires before navigation completes",
        "Redirect chain causing URL mismatch with expectation",
      ],
      fixSuggestions: [
        "Use page.waitForURL() instead of immediate expect(page).toHaveURL()",
        "Assert with a regex URL pattern for flexibility",
        "Use waitForLoadState('domcontentloaded') after SPA route changes",
      ],
    },
  },

  "form-submission": {
    type: "form-submission",
    description: "Filling and submitting a form, verifying the result",
    dom: {
      prioritySelectors: [
        "form",
        "input",
        "textarea",
        "select",
        'button[type="submit"]',
        '[type="submit"]',
      ],
      contextHint:
        "Form submission scenario: locate the form, fill all fields, submit, " +
        "verify success message or redirect.",
    },
    generation: {
      focus:
        "Fill all form fields, handle dropdowns/checkboxes, submit, assert success",
      requiredActions: ["fill", "click"],
      promptHints: [
        "Fill every visible input, textarea, and select in the form",
        "Use selectOption() for dropdowns",
        "Use check() for checkboxes",
        "Assert a success message or URL change after submit",
        "Check for inline validation errors if submit fails",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.fill\s*\(/, description: "form field fill" },
        {
          pattern: /toBeVisible|toContainText|toHaveURL/,
          description: "submission result assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Required field not found by selector",
        "Server-side validation blocking submission",
        "CSRF token or hidden field not handled",
      ],
      fixSuggestions: [
        "Use getByLabel() to find form fields reliably",
        "Wait for form validation to settle before asserting",
        "Inspect network response after submit for error details",
      ],
    },
  },

  "page-load": {
    type: "page-load",
    description: "Page navigates successfully and main content is visible",
    dom: {
      prioritySelectors: ["h1", "main", '[role="main"]', "header", "nav"],
      contextHint:
        "Page load scenario: navigate, wait for domcontentloaded, assert title " +
        "or main heading is visible and URL is correct.",
    },
    generation: {
      focus:
        "Navigate to URL, assert page title/heading visible, verify URL is correct",
      requiredActions: ["goto"],
      promptHints: [
        "Use waitUntil: 'domcontentloaded' on page.goto()",
        "Assert page title with expect(page).toHaveTitle()",
        "Assert the main H1 heading is visible",
        "Assert the URL matches the expected pattern",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /page\.goto/, description: "page navigation" },
        {
          pattern: /toHaveTitle|toHaveURL|toBeVisible/,
          description: "page load assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "URL not reachable — network or DNS issue",
        "Page title changed since test was written",
        "Content hidden behind authentication wall",
      ],
      fixSuggestions: [
        "Verify URL is publicly accessible before running tests",
        "Use regex for title assertion: /expected.*title/i",
        "Check if the page requires login and add auth setup",
      ],
    },
  },

  "visibility-check": {
    type: "visibility-check",
    description: "Key UI elements are visible and rendered correctly",
    dom: {
      prioritySelectors: ["h1", "h2", "header", "nav", "main", "footer"],
      contextHint:
        "Visibility check: assert that key structural elements (header, nav, main content) " +
        "are all visible after page load.",
    },
    generation: {
      focus:
        "Assert that critical UI elements are visible after page load",
      requiredActions: ["goto"],
      promptHints: [
        "Assert header, navigation, and main content area are all visible",
        "Use toBeVisible() on each critical element",
        "Verify no error banners or 404 messages are shown",
      ],
    },
    validation: {
      requiredPatterns: [
        {
          pattern: /toBeVisible/,
          description: "visibility assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Element hidden by CSS (display:none or visibility:hidden)",
        "Element rendered outside viewport",
        "JS error preventing render",
      ],
      fixSuggestions: [
        "Use isVisible() check before asserting",
        "Scroll element into view before assertion",
        "Check browser console for JS errors",
      ],
    },
  },

  validation: {
    type: "validation",
    description: "Verify specific content, states, and data values",
    dom: {
      prioritySelectors: [
        "[data-testid]",
        "[aria-label]",
        "h1",
        "h2",
        "p",
        "span",
      ],
      contextHint:
        "Validation scenario: assert specific text content, element states " +
        "(enabled, checked), and data accuracy.",
    },
    generation: {
      focus:
        "Assert text content, element states, and data values are correct",
      requiredActions: ["goto"],
      promptHints: [
        "Use toContainText() for flexible text matching",
        "Use toBeEnabled() and toBeChecked() for state assertions",
        "Use toHaveAttribute() for attribute values",
        "Wait for dynamic content before asserting",
      ],
    },
    validation: {
      requiredPatterns: [
        {
          pattern: /toContainText|toHaveText|toBeVisible|toHaveAttribute/,
          description: "content or state assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Expected text not found — content is dynamic or localized",
        "Element state mismatch — async update not awaited",
        "Assertion too strict — exact text vs partial match",
      ],
      fixSuggestions: [
        "Use regex for flexible text matching: /expected text/i",
        "Wait for network response before asserting dynamic content",
        "Prefer toContainText over toHaveText for partial matches",
      ],
    },
  },

  "modal-interaction": {
    type: "modal-interaction",
    description: "Open a modal/dialog, interact with it, close it",
    dom: {
      prioritySelectors: [
        '[role="dialog"]',
        '[aria-modal="true"]',
        ".modal",
        'button[data-toggle="modal"]',
        "[data-modal-target]",
      ],
      contextHint:
        "Modal scenario: trigger modal open, wait for modal to be visible, " +
        "interact with content, close modal, verify it is gone.",
    },
    generation: {
      focus:
        "Click modal trigger, wait for modal visible, interact, close, assert closed",
      requiredActions: ["click"],
      promptHints: [
        "Click the trigger button that opens the modal",
        'Wait for modal: await expect(modal).toBeVisible() or locator.waitFor()',
        "Interact with modal content (fill forms, click buttons)",
        "Close the modal via close button or Escape key",
        'Assert modal is gone: await expect(modal).toBeHidden()',
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.click\s*\(/, description: "modal trigger click" },
        {
          pattern: /toBeVisible|waitFor/,
          description: "modal visibility check",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Modal trigger not found by selector",
        "Modal animation delay causing assertion to fire before it's visible",
        "Modal not closing — close button selector changed",
      ],
      fixSuggestions: [
        'Use getByRole("dialog") to locate the modal container',
        "Wait for modal animation: locator.waitFor({ state: 'visible' })",
        "Use keyboard.press('Escape') as fallback close action",
      ],
    },
  },

  "error-handling": {
    type: "error-handling",
    description: "Detect and verify error messages and alert banners",
    dom: {
      prioritySelectors: [
        '[role="alert"]',
        ".error",
        ".alert",
        "[data-testid*=error]",
        "[data-testid*=alert]",
      ],
      contextHint:
        "Error handling scenario: trigger an error condition, assert error message " +
        "or alert banner appears with correct text.",
    },
    generation: {
      focus:
        "Trigger error condition, assert error/alert message appears with correct text",
      requiredActions: ["click", "fill"],
      promptHints: [
        "Trigger the error (e.g. submit empty form, navigate to invalid page)",
        'Assert error message using getByRole("alert") or getByText',
        "Verify error message text matches expected content",
        "Verify the error disappears after correcting the input",
      ],
    },
    validation: {
      requiredPatterns: [
        {
          pattern: /alert|error|toContainText/i,
          description: "error message assertion",
        },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Error message selector changed",
        "Error only appears briefly and assertion missed it",
        "Error text changed or is localized",
      ],
      fixSuggestions: [
        'Use getByRole("alert") for maximum resilience',
        "Add waitFor on the alert element before asserting text",
        "Use regex for text matching to handle minor wording changes",
      ],
    },
  },

  interaction: {
    type: "interaction",
    description: "Click interactive elements and verify responses",
    dom: {
      prioritySelectors: [
        "button",
        '[role="button"]',
        "a",
        "[onclick]",
        "[tabindex]",
      ],
      contextHint:
        "Interaction scenario: locate buttons and clickable elements, " +
        "click them in the described order, assert the result of each click.",
    },
    generation: {
      focus:
        "Click each specified button/element in order, assert visible response after each click",
      requiredActions: ["click"],
      promptHints: [
        "Follow the exact click sequence described in the user request",
        "Use getByRole('button', { name: /text/i }) to locate buttons",
        "After each click, assert the expected result (new panel, text, URL change)",
        "Wait for the element to be visible before clicking",
        "Use waitForLoadState or waitForSelector between sequential clicks",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /\.click\s*\(/, description: "click action" },
        { pattern: /toBeVisible|toContainText|toHaveURL/, description: "post-click assertion" },
      ],
      scoringBonus: 1,
    },
    analysis: {
      commonFailureCauses: [
        "Button not found — text or role changed",
        "Second click fires before first action settled",
        "Element obscured by overlay or modal",
      ],
      fixSuggestions: [
        "Use getByRole('button', { name: /exact text/i }) for button lookup",
        "Add waitForSelector between sequential clicks",
        "Check for overlaying elements blocking the click target",
      ],
    },
  },

  "generic-test": {
    type: "generic-test",
    description: "General page verification — load, content visible, one interaction",
    dom: {
      prioritySelectors: ["body", "main", "h1", "a", "button"],
      contextHint:
        "Generic test: verify page loads without error, main content is visible, " +
        "and at least one meaningful interaction can be performed.",
    },
    generation: {
      focus:
        "Navigate to page, verify it loads, perform at least one basic interaction",
      requiredActions: ["goto"],
      promptHints: [
        "Navigate to the URL and wait for domcontentloaded",
        "Assert the page title or main heading is visible",
        "Perform one meaningful interaction (click a link, button, or fill a field)",
        "Assert the result of that interaction",
      ],
    },
    validation: {
      requiredPatterns: [
        { pattern: /page\.goto/, description: "page navigation" },
        { pattern: /expect/, description: "at least one assertion" },
      ],
      scoringBonus: 0,
    },
    analysis: {
      commonFailureCauses: [
        "Page not loading — network or URL issue",
        "Unexpected content or authentication required",
      ],
      fixSuggestions: [
        "Verify URL is publicly accessible",
        "Check if page requires authentication and add auth setup",
      ],
    },
  },
};

/**
 * Returns the ScenarioStrategy objects for a list of scenario type strings.
 * Falls back to 'generic-test' if no strategies match.
 */
export function getStrategiesForScenarios(
  scenarios: string[]
): ScenarioStrategy[] {
  const strategies = scenarios
    .map((s) => SCENARIO_STRATEGIES[s])
    .filter((s): s is ScenarioStrategy => s !== undefined);

  return strategies.length > 0
    ? strategies
    : [SCENARIO_STRATEGIES["generic-test"]!];
}
