import { spawn } from "child_process";
import { logger } from "../utils/logger";
import { FileManager } from "../utils/file-manager";
import path from "path";

export interface ValidationResult {
  syntaxScore: number;
  selectorScore: number;
  assertionScore: number;
  coverageScore: number;
  overallAccuracy: number;
  issues: string[];
}

export class ValidatorAgent {
  static async validate(
    scriptPath: string,
    scenarioCount: number
  ): Promise<ValidationResult> {
    logger.info("Validator Agent is running...");
    logger.info(`Validating script: ${scriptPath}`);
    logger.info(`Expected scenario count: ${scenarioCount}`);

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

      // Calculate overall accuracy
      const overallAccuracy = Math.round(
        (syntaxScore + selectorScore + assertionScore + coverageScore) / 4
      );

      const result: ValidationResult = {
        syntaxScore,
        selectorScore,
        assertionScore,
        coverageScore,
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
