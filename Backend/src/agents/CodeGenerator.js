import llmClient from '../core/LlmClient.js';
import promptLoader from '../config/PromptLoader.js';

/**
 * CodeGenerator translates proven browser session logs into clean, executable Playwright test scripts.
 */
class CodeGenerator {
  async generate(actionLog) {
    console.log('[CodeGenerator] Converting browser session actions to Playwright test script...');
    let prompt = await this.buildCodeGenPrompt(actionLog);
    
    let attempts = 3;
    while (attempts > 0) {
      try {
        const raw = await llmClient.ask(prompt);
        const code = this.extractCode(raw);
        this.brittleAssertionCheck(code);
        this.validateCode(code);
        return code;
      } catch (err) {
        attempts--;
        if (attempts === 0) {
          throw err;
        }
        console.warn(`[CodeGenerator] Spec check failed. Retrying... (${attempts} attempts remaining)`);
        console.warn(`Error details: ${err.message}`);
        // Append the feedback to the prompt for the next attempt
        prompt = `${prompt}\n\n⚠️ PREVIOUS ATTEMPT FAILED WITH THE FOLLOWING BRITTLE ASSERTION/VALIDATION ERRORS:\n${err.message}\n\nPlease fix these issues and regenerate the code correctly.`;
      }
    }
  }

  async buildCodeGenPrompt(log) {
    const stepsDescription = log.actions.map((a, i) => 
      `Step ${i + 1}: Called ${a.tool}(${JSON.stringify(a.args)})\nReason: ${a.reasoning || 'No reason'}\nResult: ${a.result || 'success'}`
    ).join('\n\n');

    const testDir = log.testDir || 'tests/generated';
    const screenshotDir = testDir.replace(/^tests/, 'test-results').replace(/\\/g, '/');

    // Load template dynamically using PromptLoader
    let template;
    try {
      template = await promptLoader.getPrompt('generator', log.scenarioType);
    } catch (err) {
      console.warn(`[CodeGenerator] Specialized prompt for scenario '${log.scenarioType}' not found. Falling back to generic.`);
      template = await promptLoader.getPrompt('generator', 'generic');
    }

    const completedStr = log.completed ? 'true' : 'false';
    const completionReasonStr = log.completionReason || 'None';

    let prompt = template
      .replace(/{domain}/g, log.domain)
      .replace(/{scenarioType}/g, log.scenarioType)
      .replace(/{totalSteps}/g, log.totalSteps)
      .replace(/{completed}/g, completedStr)
      .replace(/{completionReason}/g, completionReasonStr)
      .replace(/{screenshotDir}/g, screenshotDir)
      .replace(/{stepsDescription}/g, stepsDescription);

    return prompt;
  }

  extractCode(rawResponse) {
    let cleanText = rawResponse.trim();
    
    // If it starts with markdown code block syntax
    if (cleanText.startsWith('```')) {
      const firstNewline = cleanText.indexOf('\n');
      if (firstNewline !== -1) {
        cleanText = cleanText.substring(firstNewline + 1);
      } else {
        cleanText = cleanText.replace(/^```(?:javascript|js)?/, '');
      }
    }
    
    // If it ends with markdown code block syntax
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    
    return cleanText.trim();
  }

  /**
   * Scans generated code for brittle assertion patterns that are guaranteed
   * to fail on subsequent runs (session-hardcoded values, exact strings, etc.).
   * Throws a descriptive error so the issue is caught before the file is written.
   */
  brittleAssertionCheck(code) {
    const lines = code.split('\n');
    const warnings = [];
    const errors = [];

    const brittlePatterns = [
      {
        // toHaveTitle('exact string') — titles change; must use regex
        re: /\.toHaveTitle\(\s*['"`][^/]/,
        message: 'toHaveTitle() uses an exact string. Use a regex instead: /^SiteName/ or /keyword/i'
      },
      {
        // toBe(<number>) on a measured value — timing/counts must use ranges
        re: /\.toBe\(\s*\d{3,}\s*\)/,
        message: 'toBe(<large-number>) detected. Measured values (timing, sizes) must use toBeGreaterThan()/toBeLessThan() ranges, never an exact value from the recording session.'
      },
      {
        // toEqual(<number>) — same issue as toBe for numbers
        re: /\.toEqual\(\s*\d{3,}\s*\)/,
        message: 'toEqual(<large-number>) detected. Use range assertions for any measured numeric value.'
      },
      {
        // innerText — unreliable in headless mode for SPAs
        re: /\.innerText(?!\w)/,
        message: 'innerText is unreliable in headless mode for SPAs. Use innerHTML.length or waitForLoadState("networkidle") instead.'
      },
      {
        // Very strict URL regex like /https:\/\/www\.exact\.com\/path\/?#?\/?$/
        re: /toHaveURL\(\s*\/https:\\\/\\\/www\\\..*\$\//,
        message: 'toHaveURL() regex is too strict (starts with https:\\/\\/ and ends with $). Use a simple partial regex like /domain\\.com\\/path/ instead.'
      },
      {
        // URL regex with end anchor $
        re: /toHaveURL\(\s*\/.*?\$\/\s*\)/,
        message: 'toHaveURL() regex uses the end anchor "$", which breaks on redirect hash routes (like /#/) or query params. Remove the "$" anchor.'
      },
      {
        // page.locator('main') alone — MSN and many SPAs do not use <main>
        re: /page\.locator\(\s*['"`]main['"`]\s*\)/,
        message: 'page.locator(\'main\') is fragile — many SPAs do not have a <main> element. Use page.waitForLoadState(\'networkidle\') and check innerHTML.length instead.'
      },
      {
        // document.querySelector / document.querySelectorAll / document.getElementById / document.getElementsByTagName inside page.evaluate()
        re: /page\.evaluate\(\s*(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{?\s*(?:return\s+)?document\.(?:querySelector|querySelectorAll|getElementById|getElementsBy)/,
        message: 'Do not use document.querySelector/querySelectorAll/getElementById/getElementsByTagName inside page.evaluate() for DOM element checks or counts. Use Playwright native locators instead (e.g. page.locator()) to support Shadow DOM and auto-waiting.'
      },
      {
        // Guessing logo/branding image alt text
        re: /page\.locator\(\s*['"`]img\[alt=["'].*logo.*["']\]['"`]\s*\)/i,
        message: 'Avoid guessing image alt selectors containing "logo" (e.g., img[alt="...logo..."]). These are usually fragile guesses. Use page.locator(\'a[href*="domain"]\').first() or verify main page text/headers instead.'
      },
      {
        // toBeVisible() on page.locator('a').first()
        re: /expect\(\s*page\.locator\(\s*['"`]a.*['"`]\s*\)\.first\(\)\s*\)\.toBeVisible\(\)/,
        message: 'Do not use toBeVisible() on page.locator(\'a\').first() as the first link on many pages is a hidden skip link. Assert toBeAttached() instead, or target a specific visible element.'
      }
    ];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // skip comments

      for (const { re, message } of brittlePatterns) {
        if (re.test(line)) {
          errors.push(`  Line ${lineNum}: ${message}\n    → ${line.trim()}`);
        }
      }
    });

    if (errors.length > 0) {
      const report = errors.join('\n\n');
      console.warn(`[CodeGenerator] ⚠️  Brittle assertion patterns detected in generated spec:\n${report}`);
      console.warn('[CodeGenerator] Retrying code generation with stricter emphasis on assertion rules...');
      // Throw so the orchestrator can decide to retry or skip
      throw new Error(
        `Generated spec contains ${errors.length} brittle assertion(s) that would fail on subsequent runs:\n${report}\n\nPlease regenerate with resilient assertions (regex, ranges, not session-recorded exact values).`
      );
    }
  }

  validateCode(code) {
    if (!code.includes('require(') && !code.includes('import ')) {
      throw new Error('Generated code is missing Playwright test imports');
    }
    if (!code.includes('test(')) {
      throw new Error('Generated code lacks a test() block');
    }
  }

}

const codeGenerator = new CodeGenerator();
export default codeGenerator;
