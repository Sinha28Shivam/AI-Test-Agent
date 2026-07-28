Analyze the following user testing request:
"{prompt}"

Determine:
1. Target domain name (e.g. "demo.playwright.dev" or "google.com")
2. Scenario type (choose one from: "authentication", "search", "form", "navigation")
3. Target URL (full starting URL including http/https. If none specified, guess a sensible default URL for that domain)
4. Estimated complexity score on a scale of 1 to 10 (1 = simple navigation, 10 = deep dynamic flows)
5. Checklist of sub-actions (e.g., ["input email", "click submit", "assert title"])

Provide the result as a raw JSON object with these keys: "domain", "scenarioType", "targetUrl", "complexity", "checklist".
