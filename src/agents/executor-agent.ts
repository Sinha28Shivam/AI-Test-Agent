import { spawn } from "child_process";
import { logger } from "../utils/logger";
import { FileManager } from "../utils/file-manager";
import path from "path";

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  timestamp: string;
  testFile: string;
  tests: Array<{
    title: string;
    status: "passed" | "failed" | "skipped";
    duration: number;
    error?: string;
  }>;
}

export class ExecutorAgent {
  static async execute(testFilePath: string): Promise<TestResult> {
    logger.info("Executor Agent is running...");
    logger.info(`Executing test file: ${testFilePath}`);

    try {
      const result = await this.runPlaywrightTests(testFilePath);
      logger.success(`Test execution completed. Passed: ${result.passed}, Failed: ${result.failed}`);
      return result;
    } catch (error) {
      logger.error(`Executor Agent failed: ${error}`);
      throw error;
    }
  }

  private static runPlaywrightTests(testFilePath: string): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timestamp = new Date().toISOString();

      logger.info(`Starting Playwright test execution for: ${testFilePath}`);

      const child = spawn("npx", ["playwright", "test", testFilePath, "--reporter=json"], {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd()
      });

      let stdout = "";
      let stderr = "";

      if (child.stdout) {
        child.stdout.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          logger.info(`[PLAYWRIGHT] ${chunk.substring(0, 100)}`);
        });
      }

      if (child.stderr) {
        child.stderr.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          logger.warn(`[PLAYWRIGHT ERR] ${chunk.substring(0, 100)}`);
        });
      }

      const timeout = setTimeout(() => {
        child.kill();
        logger.error("Playwright test execution timeout (300s)");
        reject(new Error("Playwright test timeout after 300 seconds"));
      }, 300000); // 5 minutes timeout

      child.on("close", (code: number) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        logger.info(`Playwright exited with code: ${code}`);

        try {
          // Parse JSON output from Playwright
          const result = this.parsePlaywrightOutput(stdout, stderr, testFilePath, timestamp, duration, code);
          
          if (code === 0) {
            logger.success("All tests passed!");
          } else if (code === 1) {
            logger.warn("Some tests failed");
          }

          resolve(result);
        } catch (error) {
          logger.error(`Failed to parse Playwright output: ${error}`);
          reject(error);
        }
      });

      child.on("error", (err: Error) => {
        clearTimeout(timeout);
        logger.error(`Failed to spawn Playwright: ${err.message}`);
        reject(new Error(`Failed to spawn Playwright: ${err.message}`));
      });
    });
  }

  private static parsePlaywrightOutput(
    stdout: string,
    stderr: string,
    testFilePath: string,
    timestamp: string,
    duration: number,
    exitCode: number
  ): TestResult {
    let testResult: any = {
      suites: [],
      tests: []
    };

    // Try to parse JSON from stdout
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        testResult = JSON.parse(jsonMatch[0]);
        logger.info("Successfully parsed Playwright JSON output");
      } catch (e) {
        logger.warn("Failed to parse JSON from Playwright output, using fallback parsing");
      }
    }

    // Fallback: Parse from stderr or use defaults
    const stats = testResult.stats || {
      expected: 0,
      unexpected: 0,
      skipped: 0,
      duration: duration
    };

    const tests = this.extractTestsFromResult(testResult);

    const result: TestResult = {
      passed: stats.expected || 0,
      failed: stats.unexpected || 0,
      skipped: stats.skipped || 0,
      total: (stats.expected || 0) + (stats.unexpected || 0) + (stats.skipped || 0),
      duration: stats.duration || duration,
      timestamp,
      testFile: testFilePath,
      tests
    };

    // If no tests were parsed, create a basic entry based on exit code
    if (result.tests.length === 0) {
      if (exitCode === 0) {
        result.passed = 1;
        result.total = 1;
        result.tests.push({
          title: "Test execution",
          status: "passed",
          duration: duration
        });
      } else {
        result.failed = 1;
        result.total = 1;
        result.tests.push({
          title: "Test execution",
          status: "failed",
          duration: duration,
          error: stderr || "Test execution failed"
        });
      }
    }

    return result;
  }

  private static extractTestsFromResult(result: any): Array<any> {
    const tests: any[] = [];

    if (result.tests && Array.isArray(result.tests)) {
      result.tests.forEach((test: any) => {
        tests.push({
          title: test.title || "Unknown test",
          status: test.status === "passed" ? "passed" : test.status === "failed" ? "failed" : "skipped",
          duration: test.duration || 0,
          error: test.error ? test.error.message || test.error : undefined
        });
      });
    }

    if (result.suites && Array.isArray(result.suites)) {
      result.suites.forEach((suite: any) => {
        if (suite.tests && Array.isArray(suite.tests)) {
          suite.tests.forEach((test: any) => {
            tests.push({
              title: `${suite.title || "Suite"} > ${test.title || "Test"}`,
              status: test.ok ? "passed" : "failed",
              duration: test.duration || 0,
              error: test.error ? test.error.message || test.error : undefined
            });
          });
        }
      });
    }

    return tests;
  }

  static saveResults(result: TestResult, reportPath: string): void {
    logger.info(`Saving test results to: ${reportPath}`);

    try {
      const reportDir = path.dirname(reportPath);
      if (!FileManager.exists(reportDir)) {
        FileManager.write(reportPath, ""); // This will create directories
      }

      FileManager.write(reportPath, JSON.stringify(result, null, 2));
      logger.success(`Test results saved to ${reportPath}`);
    } catch (error) {
      logger.error(`Failed to save results: ${error}`);
      throw error;
    }
  }
}
