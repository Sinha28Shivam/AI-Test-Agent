import { logger } from "../utils/logger";
import { AIConfig } from "../utils/ai-config";
import { FileManager } from "../utils/file-manager";
import { DOMSnapshot } from "./dom-types";
import { ScenarioResult } from "./scenario-agent";
import { ScenarioStrategy } from "./scenario-strategy";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";

export class AIGeneratorAgent {
  static async generate(data: ScenarioResult, errorContext?: string): Promise<string> {
    logger.info("AI Generator Agent is running...");
    logger.info(`Generating tests for: ${data.url}`);
    logger.info(`Scenarios: ${data.scenarios.join(", ")}`);

    if (data.strategies?.length > 0) {
      logger.info(`  Thinking mode: scenario-based (${data.strategies.length} strateg${data.strategies.length === 1 ? "y" : "ies"})`);
      data.strategies.forEach((s) =>
        logger.info(`  [${s.type}] focus → ${s.generation.focus}`)
      );
    }

    if (data.domSnapshots && data.domSnapshots.length > 0) {
      logger.info(`Using ${data.domSnapshots.length} DOM snapshot(s) covering: ${data.domSnapshots.map(s => s.url).join(", ")}`);
    } else if (data.domSnapshot) {
      logger.info(`Using DOM snapshot with ${data.domSnapshot.elements.length} extracted elements`);
    }

    const scenarioText = data.scenarios.join(", ");
    const keywordsText = data.actionKeywords?.join(", ") || "verify, check, validate";

    const domContext = this.buildDOMContext(data);

    let prompt = "";
    const promptPath = path.join(__dirname, "..", "test-script-prompt.yaml");

    try {
      if (fs.existsSync(promptPath)) {
        logger.info(`Loading test generation prompt template from: ${promptPath}`);
        const fileContent = fs.readFileSync(promptPath, "utf8");
        
        // Parse the YAML template
        const promptTemplate = yaml.load(fileContent) as any;
        
        // Populate the input section
        if (promptTemplate && promptTemplate.input) {
          promptTemplate.input.url = data.url;
          promptTemplate.input.scenarios = data.scenarios;
          promptTemplate.input.user_request = data.rawPrompt || "";
          promptTemplate.input.dom_snapshot = (data.domSnapshots && data.domSnapshots.length > 0)
            ? data.domSnapshots.map(s => `--- ${s.url} ---\n${this.formatDOMForPrompt(s)}`).join("\n\n")
            : data.domSnapshot
              ? this.formatDOMForPrompt(data.domSnapshot)
              : "No DOM snapshot available";
          promptTemplate.input.expected_test_count = data.scenarios.length;
          if (data.allUrls.length > 1) {
            promptTemplate.input.all_urls = data.allUrls;
          }
          if (errorContext) {
            promptTemplate.input.previous_execution_failure = errorContext;
          }
        }

        // Inject scenario-strategy thinking block into the template
        if (data.strategies?.length > 0) {
          promptTemplate.scenario_thinking = this.buildScenarioThinkingBlock(data.strategies);
        }

        // Inject platform-specific hints for known dynamic sites
        const platformHints = this.detectPlatformHints(data.url, data.rawPrompt || "");
        if (platformHints && promptTemplate.strict_rules) {
          if (!promptTemplate.strict_rules.platform_hints) {
            promptTemplate.strict_rules.platform_hints = [];
          }
          promptTemplate.strict_rules.platform_hints.push(...platformHints);
        }

        // Dump back to YAML string
        prompt = yaml.dump(promptTemplate, { noRefs: true, forceQuotes: false });
      } else {
        logger.warn(`Prompt template not found at ${promptPath}, falling back to hardcoded prompt`);
        prompt = this.getFallbackPrompt(data, scenarioText, keywordsText, domContext);
      }
    } catch (error) {
      logger.error(`Error loading prompt template: ${error}`);
      prompt = this.getFallbackPrompt(data, scenarioText, keywordsText, domContext);
    }

    try {
      logger.info("Calling AI provider for code generation...");
      const provider = AIConfig.getGeneratorProvider();
      
      const response = await provider.generate(prompt);

      if (!response.success || !response.data) {
        throw new Error(`Generator failed: ${response.error}`);
      }

      let generatedCode = response.data.trim();

      if (generatedCode.length === 0) {
        throw new Error("AI provider returned empty code");
      }

      // Detect AI refusals before any further processing
      const REFUSAL_PATTERNS = [
        /^I['']m sorry/i,
        /^I cannot assist/i,
        /^I['']m unable/i,
        /cannot assist with that/i,
        /^Sorry,? I (can['']t|cannot)/i,
      ];
      if (REFUSAL_PATTERNS.some((p) => p.test(generatedCode))) {
        throw new Error(`AI provider refused the request: ${generatedCode.substring(0, 80)}`);
      }

      // Strip non-code prefix lines that Copilot CLI sometimes prepends
      // (e.g. "✗ Create auth.spec.js", file-path lines, markdown fences)
      generatedCode = this.sanitizeCode(generatedCode);

      if (generatedCode.length === 0) {
        throw new Error("AI provider returned no extractable JavaScript code");
      }

      // Validate generated code
      this.validateGeneratedCode(generatedCode);

      // Repo defaults to CommonJS for .js (no "type": "module"); normalize common ESM import form.
      generatedCode = this.convertPlaywrightImportToCommonJS(generatedCode);

      // Save to file
      const filePath = path.join("tests", "generated", "auth.spec.js");
      logger.info(`Writing generated script to: ${filePath}`);

      FileManager.write(filePath, generatedCode);
      logger.success(`✓ Playwright test script generated by ${response.provider}`);
      logger.success(`✓ Saved to ${filePath} (${generatedCode.length} chars)`);

      return filePath;
    } catch (error) {
      logger.error(`AI Generator Agent failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build a structured "scenario thinking" block that tells the AI exactly
   * what to generate for each detected scenario.
   */
  private static buildScenarioThinkingBlock(
    strategies: ScenarioStrategy[]
  ): object {
    return strategies.map((s) => ({
      scenario: s.type,
      description: s.description,
      focus: s.generation.focus,
      required_actions: s.generation.requiredActions,
      generation_hints: s.generation.promptHints,
      dom_context_hint: s.dom.contextHint,
    }));
  }

  /**
   * Detect platform-specific hints for known dynamic sites (Corrected to avoid timeouts)
   */
  private static detectPlatformHints(url: string, prompt: string): string[] | null {
    const hints: string[] = [];

    // Dynamic apps / SPAs
    if (url.includes('msn.com') || prompt.toLowerCase().includes('personali') || prompt.toLowerCase().includes('dynamic')) {
      hints.push(
        "Use waitUntil: 'domcontentloaded' on page.goto().",
        "NEVER use page.waitForLoadState('networkidle') or page.waitForLoadState('load') as ad networks and trackers will hang indefinitely.",
        "Verify asynchronous elements render using: await locator.waitFor({ state: 'visible', timeout: 15000 }) before performing actions.",
        "Locate dynamic elements using getByRole() or getByText() with exact: false or regex rules.",
        "Ensure search inputs are visible and focused before typing. Always locate the search input inside the personalization dialog/panel using page.getByRole('searchbox', { name: /search/i }) or page.getByPlaceholder(/search/i) instead of using or reusing the main/global page search input.",
        "To wait for a dialog/modal/panel, prefer locating it by its role and accessible name (e.g. getByRole('dialog', { name: /personalize/i })) instead of page.locator('[role=\"dialog\"]').first(), as there may be hidden dialog elements in the DOM.",
        "NEVER use locator.count() or locator.isVisible() inside conditional 'if' statements immediately after actions to check if a dynamic element (like a modal/dialog) has appeared. These methods do not auto-wait and will return false/0 before the element has loaded. Instead, directly target the element and wait for it using await locator.waitFor({ state: 'visible' })."
      );
    }

    return hints.length > 0 ? hints : null;
  }

  private static buildDOMContext(data: ScenarioResult): string {
    if (data.domSnapshots && data.domSnapshots.length > 0) {
      return "\n\nExtracted Page Elements (all visited URLs):\n" +
        data.domSnapshots
          .map((s) => `\n--- ${s.url} ---\n${this.formatDOMForPrompt(s)}`)
          .join("\n");
    }
    if (data.domSnapshot) {
      return "\n\nExtracted Page Elements:\n" + this.formatDOMForPrompt(data.domSnapshot);
    }
    return "";
  }

  /**
   * Format DOM snapshot for inclusion in AI prompt
   */
  private static formatDOMForPrompt(snapshot: DOMSnapshot): string {
    let format = `\nPage Statistics: 
    - Total Elements: ${snapshot.totalElements}
    - Buttons: ${snapshot.statistics.buttons}
    - Links: ${snapshot.statistics.links}
    - Inputs: ${snapshot.statistics.inputs}
    - Interactive Elements: ${snapshot.statistics.interactiveElements}
    `;

    if (snapshot.strategyHints && snapshot.strategyHints.length > 0){
      format += `\nScenario context (what to focus on):\n`;
      snapshot.strategyHints.forEach((h) => (format += ` - ${h}\n`));
    }

    format += `\nInteractive Elements found on page (use these selectors and metadata): \n`;
    snapshot.elements.forEach((el) => {
      const parts: string[] = [];
      parts.push(`selector: ${el.selector}`);
      parts.push(`tag: ${el.tagName}`);
      if (el.text) parts.push(`text: "${el.text.replace(/\n/g, ' ')}"`)
      if (el.placeholder) parts.push(`placeholder: "${el.placeholder}"`)
      if (el.ariaLabel) parts.push(`aria-label: "${el.ariaLabel}"`);
      if (el.id) parts.push(`id: "${el.id}"`);
      if (el.iframeContext) parts.push(`iframeContext: "${el.iframeContext}"`);
      format += ` - [${el.type.toUpperCase()}] ${parts.join(" | ")}\n`;
    })
    return format;
  }



  private static validateGeneratedCode(code: string): void {
    logger.info("Validating generated code structure...");

    const checks = [
      {
        pattern:
          /(import\s+\{[\s\S]*\}\s+from\s+['"]@playwright\/test['"]|require\s*\(\s*['"]@playwright\/test['"]\s*\))/s,
        name: "imports"
      },
      { pattern: /test\s*\(/s, name: "test cases" },
      { pattern: /page\.goto/s, name: "navigation" },
      { pattern: /expect\s*\(/s, name: "assertions" },
    ];

    const results = checks.map(check => ({
      name: check.name,
      passed: check.pattern.test(code)
    }));

    const allPassed = results.every(r => r.passed);
    
    results.forEach(result => {
      if (result.passed) {
        logger.info(`  ✓ ${result.name}`);
      } else {
        logger.warn(`  ⚠ ${result.name}`);
      }
    });

    if (!allPassed) {
      logger.warn("⚠ Some validations failed - code may need regeneration");
    } else {
      logger.success("✓ All validations passed");
    }
  }

  /**
   * Strip non-JavaScript content that Copilot CLI sometimes prepends to its output.
   * Examples of noise: "✗ Create file.spec.js", "│ path/to/file", markdown fences.
   * Finds the first line that looks like the beginning of a JS/TS source file.
   */
  private static sanitizeCode(code: string): string {
    // First, try to extract code inside the first code fence if it exists
    const codeFenceMatch = code.match(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)\n```/);
    let sanitized = code;
    if (codeFenceMatch && codeFenceMatch[1]) {
      sanitized = codeFenceMatch[1].trim();
      logger.info("Sanitized code: extracted JavaScript code block using code fences");
      return sanitized;
    }

    // Fallback: Remove markdown code fences manually
    sanitized = sanitized
      .replace(/^```(?:javascript|js|typescript|ts)?\s*\n/gm, "")
      .replace(/^```\s*$/gm, "");

    const lines = sanitized.split("\n");
    const codeStartPatterns = [
      /^const\s+\{/,         // const { test, expect } = require(...)
      /^const\s+\w/,         // const foo = ...
      /^require\s*\(/,       // require('...')
      /^import\s+/,          // import { ... } from '...'
      /^\/\//,               // // comment
      /^\/\*/,               // /* block comment */
      /^'use strict'/,
      /^"use strict"/,
      /^test\s*[\.(]/,       // test( or test.describe(
      /^describe\s*\(/,
    ];

    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = (lines[i] ?? "").trim();
      if (codeStartPatterns.some((p) => p.test(trimmed))) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      logger.warn("sanitizeCode: no JavaScript code start pattern found in AI response");
      return "";
    }

    // Filter out trailing lines that look like markdown lists, headers, or explanations
    let endIndex = lines.length - 1;
    const trailingMarkdownPatterns = [
      /^\s*\*\*/,          // **bold text**
      /^\s*-\s+/,          // - list item
      /^\s*\*\s+/,         // * list item
      /^\s*\d+\.\s+/,      // 1. list item
      /^\s*#/,             // # header
      /^\s*Key features/i,
      /^\s*Key improvements/i,
      /^\s*Note:/i,
    ];

    while (endIndex > startIndex) {
      const line = lines[endIndex];
      if (line === undefined) {
        endIndex--;
        continue;
      }
      const trimmed = line.trim();
      if (trimmed === "") {
        endIndex--;
        continue;
      }
      if (trailingMarkdownPatterns.some((p) => p.test(trimmed))) {
        endIndex--;
        continue;
      }
      // Stop if the line ends with a closing brace, parenthesis, semicolon, or a comment
      if (trimmed.endsWith("}") || trimmed.endsWith("};") || trimmed.endsWith(")") || trimmed.endsWith(");") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        break;
      }
      if (/^[A-Za-z\s]+:/.test(trimmed) || /^[A-Za-z\s]+$/.test(trimmed)) {
        endIndex--;
        continue;
      }
      break;
    }

    if (startIndex > 0 || endIndex < lines.length - 1) {
      logger.info(`Sanitized code: kept lines ${startIndex + 1} to ${endIndex + 1} of ${lines.length}`);
    }

    return lines.slice(startIndex, endIndex + 1).join("\n").trim();
  }

  private static convertPlaywrightImportToCommonJS(code: string): string {
    return code.replace(
      /^\s*import\s+\{\s*test\s*,\s*expect\s*\}\s+from\s+['"]@playwright\/test['"]\s*;?\s*$/m,
      "const { test, expect } = require('@playwright/test');"
    );
  }

  private static getFallbackPrompt(
    data: ScenarioResult,
    scenarioText: string,
    keywordsText: string,
    domContext: string
  ): string {
    const strategyBlock = data.strategies?.length > 0
      ? `\nScenario-Specific Instructions:\n` +
        data.strategies
          .map(
            (s) =>
              `[${s.type.toUpperCase()}]\n` +
              `  Focus: ${s.generation.focus}\n` +
              `  Required actions: ${s.generation.requiredActions.join(", ")}\n` +
              `  Hints:\n${s.generation.promptHints.map((h) => `    - ${h}`).join("\n")}`
          )
          .join("\n\n")
      : "";

    const urlsLine = data.allUrls.length > 1
      ? `URLs to test (in order): ${data.allUrls.join(" → ")}\nPrimary test target: ${data.url}`
      : `Target URL: ${data.url}`;

    return `Generate a production-ready Playwright JavaScript (CommonJS) test script with these requirements:

${urlsLine}
User Request: ${data.rawPrompt || ""}
Test Scenarios: ${scenarioText}
Action Keywords: ${keywordsText}${strategyBlock}${domContext}

Requirements:
1. Use @playwright/test framework
2. Use CommonJS import: const { test, expect } = require('@playwright/test');
3. Add page.goto("${data.url}") at the start of each test
4. Create one test per scenario, following the scenario-specific instructions above
5. Use the extracted elements and selectors provided above when available
6. Use generic, stable selectors (role-based, text content) - avoid brittle CSS selectors
7. Add proper assertions (URL check, element visibility, content validation)
8. Use waitForLoadState("domcontentloaded") by default.
9. Avoid networkidle unless explicitly required.
10. Include descriptive error messages in assertions
11. Add appropriate timeouts (30-60 seconds for page loads)
12. Make tests independent and reusable
13. Use async/await properly
14. Return ONLY valid JavaScript code. No markdown, no comments, no explanations.`;
  }
}

