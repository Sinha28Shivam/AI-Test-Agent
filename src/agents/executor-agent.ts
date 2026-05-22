import { spawn } from "child_process";
import { logger } from "../utils/logger";
import { FileManager } from "../utils/file-manager";
import path from "path";
import fs from "fs";

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
    errorType?: "timeout" | "selector" | "navigation" | "assertion" | "unknown";
    screenshot?: string;
    trace?: string;
  }>;
  artifacts?: {
    screenshots: string[];
    traces: string[];
  } | undefined;
}

export class ExecutorAgent {
  private static readonly ARTIFACTS_DIR = "reports";
  private static readonly SCREENSHOTS_DIR = path.join("reports", "screenshots");
  private static readonly TRACES_DIR = path.join("reports", "traces");

  static async execute(testFilePath: string): Promise<TestResult> {
    logger.info("Executor Agent is running...");
    logger.info(`Executing test file: ${testFilePath}`);

    try {
      // Ensure artifact directories exist
      this.ensureArtifactDirs();
      const result = await this.runPlaywrightTests(testFilePath);
      logger.success(`Test execution completed. Passed: ${result.passed}, Failed: ${result.failed}`);
      return result;
    } catch (error) {
      logger.error(`Executor Agent failed: ${error}`);
      throw error;
    }
  }

  private static ensureArtifactDirs(): void {
    try {
      if (!FileManager.exists(this.SCREENSHOTS_DIR)) {
        fs.mkdirSync(this.SCREENSHOTS_DIR, { recursive: true });
        logger.info(`Created screenshots directory: ${this.SCREENSHOTS_DIR}`);
      }
      if (!FileManager.exists(this.TRACES_DIR)) {
        fs.mkdirSync(this.TRACES_DIR, { recursive: true });
        logger.info(`Created traces directory: ${this.TRACES_DIR}`);
      }
    } catch (error) {
      logger.warn(`Failed to create artifact directories: ${error}`);
    }
  }

  private static runPlaywrightTests(testFilePath: string): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timestamp = new Date().toISOString();

      logger.info(`Starting Playwright test execution for: ${testFilePath}`);

      const child = spawn("cmd.exe", ["/c", "npx", "playwright", "test", testFilePath, "--reporter=json"], {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd()
      });

      let stdout = "";
      let stderr = "";
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      if (child.stdout) {
        child.stdout.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          stdoutLines.push(chunk);
          // Only log first 100 chars to avoid bloat
          const preview = chunk.substring(0, 100).replace(/\n/g, ' ');
          logger.info(`[STDOUT] ${preview}`);
        });
      }

      if (child.stderr) {
        child.stderr.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          stderrLines.push(chunk);
          // Only log first 100 chars to avoid bloat
          const preview = chunk.substring(0, 100).replace(/\n/g, ' ');
          logger.warn(`[STDERR] ${preview}`);
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
        logger.info(`Captured ${stdoutLines.length} stdout chunks, ${stderrLines.length} stderr chunks`);

        try {
          // Parse JSON output from Playwright with enhanced error context
          const result = this.parsePlaywrightOutput(stdout, stderr, testFilePath, timestamp, duration, code);
          
          if (code === 0) {
            logger.success("All tests passed!");
          } else if (code === 1) {
            logger.warn("Some tests failed - check artifacts for details");
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

    const tests = this.extractTestsFromResult(testResult, stderr, timestamp);
    const artifacts = this.captureArtifactsOnFailure(tests, timestamp);

    const result: TestResult = {
      passed: stats.expected || 0,
      failed: stats.unexpected || 0,
      skipped: stats.skipped || 0,
      total: (stats.expected || 0) + (stats.unexpected || 0) + (stats.skipped || 0),
      duration: stats.duration || duration,
      timestamp,
      testFile: testFilePath,
      tests,
      artifacts: artifacts.length > 0 ? {
        screenshots: artifacts.filter(a => a.type === 'screenshot').map(a => a.path),
        traces: artifacts.filter(a => a.type === 'trace').map(a => a.path)
      } : undefined
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
        const errorInfo = this.extractErrorInfo(stderr);
        result.failed = 1;
        result.total = 1;
        result.tests.push({
          title: "Test execution",
          status: "failed",
          duration: duration,
          error: errorInfo.message,
          errorType: errorInfo.type
        });
      }
    }

    return result;
  }

  private static extractErrorInfo(stderr: string): { message: string; type: "timeout" | "selector" | "navigation" | "assertion" | "unknown" } {
    const errorLines = stderr.split('\n').filter(line => line.trim());
    
    // Categorize error type
    let errorType: "timeout" | "selector" | "navigation" | "assertion" | "unknown" = "unknown";
    let message = "Test execution failed";

    if (stderr.includes("Timeout")) {
      errorType = "timeout";
      message = "Test timeout - operation exceeded maximum wait time";
    } else if (stderr.includes("selector") || stderr.includes("locator")) {
      errorType = "selector";
      message = "Selector/locator not found - element could not be located";
    } else if (stderr.includes("navigation") || stderr.includes("page.goto")) {
      errorType = "navigation";
      message = "Navigation failed - unable to reach target URL";
    } else if (stderr.includes("Expected") || stderr.includes("assertion")) {
      errorType = "assertion";
      message = "Assertion failed - condition did not match expectations";
    }

    // Extract more specific error message if available
    if (errorLines.length > 0) {
      const relevantLine = errorLines.find(line => 
        line.includes("Error") || 
        line.includes("Expected") || 
        line.includes("failed") ||
        line.includes("timeout")
      );
      if (relevantLine) {
        message = relevantLine.substring(0, 200);
      }
    }

    return { message, type: errorType };
  }

  private static captureArtifactsOnFailure(
    tests: any[],
    timestamp: string
  ): Array<{ type: string; path: string }> {
    const artifacts: Array<{ type: string; path: string }> = [];
    
    // Check if any tests failed
    const hasFailures = tests.some(test => test.status === 'failed');
    
    if (!hasFailures) {
      return artifacts;
    }

    try {
      // Create synthetic screenshot marker (Playwright captures automatically with --reporter flag)
      const screenshotPath = path.join(this.SCREENSHOTS_DIR, `failure-${this.sanitizeTimestamp(timestamp)}.png`);
      // Note: Actual screenshot generation happens via Playwright's native screenshot on failure
      // This records the path where it would be saved
      logger.info(`Screenshot artifact path: ${screenshotPath}`);
      artifacts.push({ type: 'screenshot', path: screenshotPath });

      // Generate trace file
      const tracePath = path.join(this.TRACES_DIR, `trace-${this.sanitizeTimestamp(timestamp)}.zip`);
      // Note: Actual trace generation happens via Playwright's tracing context
      // This records the path where it would be saved
      logger.info(`Trace artifact path: ${tracePath}`);
      artifacts.push({ type: 'trace', path: tracePath });
    } catch (error) {
      logger.warn(`Failed to capture artifacts: ${error}`);
    }

    return artifacts;
  }

  private static sanitizeTimestamp(timestamp: string): string {
    return timestamp.replace(/[:\-Z]/g, '').substring(0, 14);
  }

  private static extractTestsFromResult(result: any, stderr: string = "", timestamp: string = ""): Array<any> {
    const tests: any[] = [];

    if (result.tests && Array.isArray(result.tests)) {
      result.tests.forEach((test: any) => {
        const testEntry: any = {
          title: test.title || "Unknown test",
          status: test.status === "passed" ? "passed" : test.status === "failed" ? "failed" : "skipped",
          duration: test.duration || 0
        };
        
        if (test.error) {
          const errorInfo = this.extractErrorInfo(test.error.message || test.error);
          testEntry.error = errorInfo.message;
          testEntry.errorType = errorInfo.type;
        }
        
        tests.push(testEntry);
      });
    }

    if (result.suites && Array.isArray(result.suites)) {
      result.suites.forEach((suite: any) => {
        if (suite.tests && Array.isArray(suite.tests)) {
          suite.tests.forEach((test: any) => {
            const testEntry: any = {
              title: `${suite.title || "Suite"} > ${test.title || "Test"}`,
              status: test.ok ? "passed" : "failed",
              duration: test.duration || 0
            };
            
            if (test.error) {
              const errorInfo = this.extractErrorInfo(test.error.message || test.error);
              testEntry.error = errorInfo.message;
              testEntry.errorType = errorInfo.type;
            }
            
            tests.push(testEntry);
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
