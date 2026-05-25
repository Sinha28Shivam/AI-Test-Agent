import { spawn } from "child_process";
import { logger } from "../utils/logger";
import { FileManager } from "../utils/file-manager";
import { ScenarioStrategy } from "./scenario-strategy";
import path from "path";

export interface ValidationResult {
  syntaxScore: number;
  selectorScore: number;
  assertionScore: number;
  coverageScore: number;
  scenarioComplianceScore: number;
  overallAccuracy: number;
  issues: string[];
}

export class ValidatorAgent {
  static async validate(
    scriptPath: string,
    scenarioCount: number,
    strategies: ScenarioStrategy[] = []
  ): Promise<ValidationResult> {
    logger.info("Validator Agent is running...");
    logger.info(`Validating script: ${scriptPath}`);
    logger.info(`Expected scenario count: ${scenarioCount}`);
    if (strategies.length > 0) {
      logger.info(`Scenario strategies to validate against: ${strategies.map(s => s.type).join(", ")}`);
    }

    try {
      // Check if file exists
      if (!FileManager.exists(scriptPath)) {
        throw new Error(`Script file not found: ${scriptPath}`);
      }

      const issues: string[] = [];

      // Step 1: Validate syntax (JS or TS depending on extension)
      const ext = path.extname(scriptPath).toLowerCase();
      let syntaxScore = 10;

      if (ext === ".js" || ext === ".cjs" || ext === ".mjs") {
        logger.info("Validating JavaScript syntax...");
        syntaxScore = await this.validateJavaScriptSyntax(scriptPath);
        if (syntaxScore < 10) {
          issues.push("JavaScript syntax validation failed");
        }
      } else {
        logger.info("Validating TypeScript syntax...");
        syntaxScore = await this.validateTypeScriptSyntax(scriptPath);
        if (syntaxScore < 10) {
          issues.push("TypeScript syntax validation failed");
        }
      }

      // Step 2: Validate Playwright syntax
      logger.info("Validating Playwright syntax...");
      const playwrightValidationPassed = await this.validatePlaywrightSyntax(
        scriptPath
      );
      if (!playwrightValidationPassed) {
        issues.push("Playwright syntax validation failed");
      }

      // Step 3: Analyze AST - selectors
      logger.info("Analyzing selectors...");
      const scriptContent = FileManager.read(scriptPath);
      const selectorScore = this.analyzeSelectorQuality(scriptContent);
      if (selectorScore < 7) {
        issues.push(
          `Selector quality is poor (score: ${selectorScore}). Consider using role-based or text content selectors instead of brittle XPath or complex CSS.`
        );
      }

      // Step 4: Analyze AST - assertions
      logger.info("Analyzing assertions...");
      const assertionScore = this.analyzeAssertionQuality(scriptContent);
      if (assertionScore < 7) {
        issues.push(
          `Assertion quality is poor (score: ${assertionScore}). Add more meaningful checks for test coverage.`
        );
      }

      // Step 5: Analyze coverage
      logger.info("Analyzing test coverage...");
      const coverageScore = this.analyzeCoverage(scriptContent, scenarioCount);
      if (coverageScore < 7) {
        issues.push(
          `Coverage score is low (score: ${coverageScore}). Expected ${scenarioCount} test cases, but found fewer.`
        );
      }

      // Step 6: Scenario compliance (scenario-based thinking check)
      let scenarioComplianceScore = 10;
      if (strategies.length > 0) {
        logger.info("Analyzing scenario compliance...");
        scenarioComplianceScore = this.analyzeScenarioCompliance(scriptContent, strategies, issues);
      }

      // Calculate overall accuracy — scenario compliance replaces a generic slot
      const scoreComponents = [syntaxScore, selectorScore, assertionScore, coverageScore];
      if (strategies.length > 0) scoreComponents.push(scenarioComplianceScore);
      let overallAccuracy = Math.round(
        scoreComponents.reduce((a, b) => a + b, 0) / scoreComponents.length
      );

      // Syntax failure is a hard block — a file that won't parse must not run
      if (syntaxScore < 10) {
        overallAccuracy = Math.min(overallAccuracy, 5);
        logger.warn("Syntax failure detected — capping overall accuracy to 5 to block execution");
      }

      const result: ValidationResult = {
        syntaxScore,
        selectorScore,
        assertionScore,
        coverageScore,
        scenarioComplianceScore,
        overallAccuracy,
        issues
      };

      logger.info(
        `Validation completed. Overall Accuracy: ${overallAccuracy}/10`
      );

      if (overallAccuracy < 7) {
        logger.warn(`Accuracy score (${overallAccuracy}) is below threshold (7).`);
        issues.push(
          "Auto-triggering regeneration due to low accuracy score"
        );
      }

      return result;
    } catch (error) {
      logger.error(`Validator Agent failed: ${error}`);
      throw error;
    }
  }

  private static async validateJavaScriptSyntax(
    scriptPath: string
  ): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn("node", ["--check", scriptPath], {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd()
      });

      let stdout = "";
      let stderr = "";

      if (child.stdout) {
        child.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
      }

      const timeout = setTimeout(() => {
        child.kill();
        logger.warn("JavaScript validation timeout");
        resolve(5);
      }, 30000);

      child.on("close", (code: number) => {
        clearTimeout(timeout);
        if (code === 0) {
          logger.success("JavaScript syntax is valid");
          resolve(10);
        } else {
          logger.warn(`JavaScript validation failed with code ${code}`);
          const combined = (stderr + "\n" + stdout).trim();
          logger.warn(`Errors: ${combined.substring(0, 400)}`);
          resolve(4);
        }
      });

      child.on("error", (err: Error) => {
        clearTimeout(timeout);
        logger.warn(`JavaScript validation error: ${err.message}`);
        resolve(3);
      });
    });
  }

  private static async validateTypeScriptSyntax(
    scriptPath: string
  ): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn("npx", ["tsc", "--noEmit", scriptPath], {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd()
      });

      let stdout = "";
      let stderr = "";

      if (child.stdout) {
        child.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
      }

      const timeout = setTimeout(() => {
        child.kill();
        logger.warn("TypeScript validation timeout");
        resolve(5);
      }, 30000);

      child.on("close", (code: number) => {
        clearTimeout(timeout);
        if (code === 0) {
          logger.success("TypeScript syntax is valid");
          resolve(10);
        } else {
          logger.warn(`TypeScript validation failed with code ${code}`);
          const combined = (stderr + "\n" + stdout).trim();
          logger.warn(`Errors: ${combined.substring(0, 400)}`);
          resolve(4);
        }
      });

      child.on("error", (err: Error) => {
        clearTimeout(timeout);
        logger.warn(`TypeScript validation error: ${err.message}`);
        resolve(3);
      });
    });
  }

  private static toPlaywrightFileFilter(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    const escapedSegments = segments.map((s) =>
      s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );

    // Playwright treats CLI args as RegExp filters; make this work on Windows regardless of path separator.
    return `${escapedSegments.join("[\\\\/]")}$`;
  }

  private static async validatePlaywrightSyntax(
    scriptPath: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const filter = this.toPlaywrightFileFilter(scriptPath);
      const child = spawn(
        "npx",
        ["playwright", "test", "--config=playwright.config.ts", "--list", filter],
        {
          shell: true,
          stdio: ["pipe", "pipe", "pipe"],
          cwd: process.cwd()
        }
      );

      let stdout = "";
      let stderr = "";

      if (child.stdout) {
        child.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
      }

      const timeout = setTimeout(() => {
        child.kill();
        logger.warn("Playwright validation timeout");
        resolve(false);
      }, 30000);

      child.on("close", (code: number) => {
        clearTimeout(timeout);
        if (code === 0) {
          logger.success("Playwright syntax is valid");
          resolve(true);
        } else {
          logger.warn(`Playwright validation failed with code ${code}`);
          const combined = (stderr + "\n" + stdout).trim();
          if (combined) {
            logger.warn(`Playwright errors: ${combined.substring(0, 400)}`);
          }
          resolve(false);
        }
      });

      child.on("error", (err: Error) => {
        clearTimeout(timeout);
        logger.warn(`Playwright validation error: ${err.message}`);
        resolve(false);
      });
    });
  }

  private static analyzeSelectorQuality(scriptContent: string): number {
    let score = 10;
    let issueCount = 0;

    // Check for brittle XPath selectors
    const xpathMatches = scriptContent.match(/locator\s*\(\s*['"`]\/\//g);
    if (xpathMatches && xpathMatches.length > 0) {
      issueCount += xpathMatches.length;
      logger.warn(
        `Found ${xpathMatches.length} brittle XPath selectors (//)`
      );
    }

    // Check for absolute XPath (bad practice)
    const absoluteXpathMatches = scriptContent.match(/\/\w+\/\w+\/\w+/g);
    if (absoluteXpathMatches && absoluteXpathMatches.length > 0) {
      issueCount += absoluteXpathMatches.length * 2;
      logger.warn(
        `Found ${absoluteXpathMatches.length} absolute XPath patterns`
      );
    }

    // Penalize for no role-based selectors
    const roleMatches = scriptContent.match(/getByRole/g);
    if (!roleMatches || roleMatches.length === 0) {
      issueCount += 2;
      logger.warn("No role-based selectors found (recommended best practice)");
    }

    // Check for complex CSS selectors
    const complexCssMatches = scriptContent.match(
      /locator\s*\(\s*['"`][^'"`]*\s*>\s*[^'"`]*\s*\+\s*[^'"`]*['"`]\)/g
    );
    if (complexCssMatches && complexCssMatches.length > 0) {
      issueCount += complexCssMatches.length;
      logger.warn(`Found ${complexCssMatches.length} complex CSS selectors`);
    }

    score = Math.max(0, 10 - issueCount);
    logger.info(`Selector quality score: ${score}/10`);
    return score;
  }

  private static analyzeAssertionQuality(scriptContent: string): number {
    let score = 10;
    let assertionCount = 0;
    let meaningfulAssertionCount = 0;

    // Count total assertions
    const assertMatches = scriptContent.match(/expect\s*\(/g);
    if (assertMatches) {
      assertionCount = assertMatches.length;
    }

    // Check for meaningful assertions
    const meaningfulAssertions = [
      /expect\([^)]*\)\.toHaveURL/g,
      /expect\([^)]*\)\.toContainText/g,
      /expect\([^)]*\)\.toHaveTitle/g,
      /expect\([^)]*\)\.toBeVisible/g,
      /expect\([^)]*\)\.toBeEnabled/g,
      /expect\([^)]*\)\.toHaveAttribute/g,
      /expect\([^)]*\)\.toHaveClass/g
    ];

    meaningfulAssertions.forEach((regex) => {
      const matches = scriptContent.match(regex);
      if (matches) {
        meaningfulAssertionCount += matches.length;
      }
    });

    // Penalize if no assertions found
    if (assertionCount === 0) {
      score = 2;
      logger.warn("No assertions found in test script");
    } else if (meaningfulAssertionCount === 0) {
      score = 4;
      logger.warn("No meaningful assertions found");
    } else if (meaningfulAssertionCount < assertionCount * 0.5) {
      score = 6;
      logger.warn(
        `Low meaningful assertion ratio: ${meaningfulAssertionCount}/${assertionCount}`
      );
    } else {
      score = Math.min(10, 7 + Math.floor(meaningfulAssertionCount / 2));
    }

    logger.info(
      `Assertion quality score: ${score}/10 (${meaningfulAssertionCount}/${assertionCount} meaningful)`
    );
    return score;
  }

  /**
   * Check that the generated code satisfies the required patterns for every
   * active scenario strategy. Each strategy contributes its own required patterns
   * and an optional bonus if all are met.
   */
  private static analyzeScenarioCompliance(
    scriptContent: string,
    strategies: ScenarioStrategy[],
    issues: string[]
  ): number {
    let totalPatterns = 0;
    let matchedPatterns = 0;
    let bonusPoints = 0;

    for (const strategy of strategies) {
      const strategyPatterns = strategy.validation.requiredPatterns;
      const allMet = strategyPatterns.every(({ pattern, description }) => {
        totalPatterns++;
        const met = pattern.test(scriptContent);
        if (met) {
          matchedPatterns++;
          logger.info(`  ✓ [${strategy.type}] ${description}`);
        } else {
          logger.warn(`  ✗ [${strategy.type}] Missing: ${description}`);
          issues.push(`[${strategy.type}] Missing required code pattern: ${description}`);
        }
        return met;
      });

      if (allMet && strategy.validation.scoringBonus > 0) {
        bonusPoints += strategy.validation.scoringBonus;
        logger.success(`  ✓ [${strategy.type}] All scenario patterns met — +${strategy.validation.scoringBonus} bonus`);
      }
    }

    if (totalPatterns === 0) return 10;

    const baseScore = Math.round((matchedPatterns / totalPatterns) * 10);
    const finalScore = Math.min(10, baseScore + bonusPoints);
    logger.info(`Scenario compliance score: ${finalScore}/10 (${matchedPatterns}/${totalPatterns} patterns met)`);
    return finalScore;
  }

  private static analyzeCoverage(
    scriptContent: string,
    scenarioCount: number
  ): number {
    // Count test cases
    const testMatches = scriptContent.match(/test\s*\(\s*['"`]/g);
    const testCount = testMatches ? testMatches.length : 0;

    logger.info(
      `Found ${testCount} test cases (expected: ${scenarioCount})`
    );

    // Calculate coverage score
    if (testCount === 0) {
      logger.warn("No test cases found");
      return 1;
    }

    if (testCount < scenarioCount) {
      const coverage = Math.round((testCount / scenarioCount) * 100);
      logger.warn(
        `Coverage is ${coverage}%. Expected ${scenarioCount} scenarios, found ${testCount}`
      );
      return Math.max(2, Math.round((testCount / scenarioCount) * 10));
    }

    if (testCount === scenarioCount) {
      logger.success(`Perfect coverage: ${testCount} tests for ${scenarioCount} scenarios`);
      return 10;
    }

    // More tests than scenarios is acceptable
    logger.success(
      `Coverage exceeds scenarios: ${testCount} tests for ${scenarioCount} scenarios`
    );
    return 10;
  }
}
