import { logger } from "../utils/logger";
import { Copilot } from "../utils/copilot";
import { TestResult } from "./executor-agent";

export interface AnalysisResult {
  hasFailures: boolean;
  rootCauses: string[];
  issues: Issue[];
  recommendations: string[];
  retryStrategy?: string;
  suggestedFixes?: string[];
}

export interface Issue {
  type: "timeout" | "selector-not-found" | "navigation" | "assertion" | "title-mismatch" | "flaky" | "other";
  description: string;
  severity: "critical" | "warning" | "info";
  affectedTests: string[];
}

export class CopilotAnalyzerAgent {
  static async analyze(testResult: TestResult): Promise<AnalysisResult> {
    logger.info("Copilot Analyzer Agent is running...");

    if (testResult.failed === 0) {
      logger.success("No failures detected - skipping deep analysis");
      return {
        hasFailures: false,
        rootCauses: [],
        issues: [],
        recommendations: ["All tests passed successfully. No action needed."],
        retryStrategy: "N/A"
      };
    }

    try {
      const failureDetails = this.extractFailureDetails(testResult);
      logger.info(`Analyzing ${testResult.failed} test failures...`);

      const analysis = await this.getAnalysisFromCopilot(testResult, failureDetails);

      logger.success("Analysis completed by Copilot");
      return analysis;
    } catch (error) {
      logger.error(`Copilot Analyzer failed: ${error}`);
      // Fallback analysis
      return this.getFallbackAnalysis(testResult);
    }
  }

  private static extractFailureDetails(testResult: TestResult): string {
    const failedTests = testResult.tests.filter((t) => t.status === "failed");

    let details = "Failed Tests:\n";
    failedTests.forEach((test) => {
      details += `\n- ${test.title}\n`;
      if (test.error) {
        details += `  Error: ${test.error.substring(0, 200)}...\n`;
      }
    });

    return details;
  }

  private static async getAnalysisFromCopilot(
    testResult: TestResult,
    failureDetails: string
  ): Promise<AnalysisResult> {
    const prompt = `You are a test automation expert. Analyze these Playwright test failures and provide recommendations:

${failureDetails}

Test Duration: ${testResult.duration}ms
Failed Tests: ${testResult.failed}
Total Tests: ${testResult.total}

For each failure, identify:
1. Root cause (timeout, selector issue, navigation problem, assertion failure, flaky test, etc.)
2. Severity (critical/warning/info)
3. Recommended fix
4. Retry strategy if applicable

Return your analysis as JSON in this format:
{
  "rootCauses": ["cause 1", "cause 2"],
  "issues": [
    {
      "type": "timeout|selector-not-found|navigation|assertion|title-mismatch|flaky|other",
      "description": "description",
      "severity": "critical|warning|info",
      "affectedTests": ["test name 1"]
    }
  ],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "retryStrategy": "strategy if applicable",
  "suggestedFixes": ["fix 1", "fix 2"]
}`;

    try {
      const response = await Copilot.ask(prompt);
      logger.info("Copilot response received");

      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysisData = JSON.parse(jsonMatch[0]);
        return {
          hasFailures: true,
          rootCauses: analysisData.rootCauses || [],
          issues: analysisData.issues || [],
          recommendations: analysisData.recommendations || [],
          retryStrategy: analysisData.retryStrategy,
          suggestedFixes: analysisData.suggestedFixes
        };
      }

      // Fallback if JSON parsing fails
      logger.warn("Could not parse structured analysis from Copilot");
      return this.getFallbackAnalysis(testResult);
    } catch (error) {
      logger.error(`Copilot analysis failed: ${error}`);
      return this.getFallbackAnalysis(testResult);
    }
  }

  private static getFallbackAnalysis(testResult: TestResult): AnalysisResult {
    logger.info("Using fallback analysis...");

    const issues: Issue[] = [];
    const recommendations: string[] = [];

    // Analyze errors in failed tests
    testResult.tests
      .filter((t) => t.status === "failed")
      .forEach((test) => {
        if (test.error) {
          const errorText = test.error.toLowerCase();

          if (errorText.includes("timeout")) {
            issues.push({
              type: "timeout",
              description: `Test '${test.title}' exceeded timeout`,
              severity: "critical",
              affectedTests: [test.title]
            });
            recommendations.push("Increase timeout for slow operations");
            recommendations.push("Check if elements take long to load");
          } else if (errorText.includes("selector") || errorText.includes("element")) {
            issues.push({
              type: "selector-not-found",
              description: `Selector issue in '${test.title}'`,
              severity: "critical",
              affectedTests: [test.title]
            });
            recommendations.push("Review and improve selectors");
            recommendations.push("Use more stable locators (role, text, testid)");
          } else if (errorText.includes("navigate") || errorText.includes("url")) {
            issues.push({
              type: "navigation",
              description: `Navigation issue in '${test.title}'`,
              severity: "warning",
              affectedTests: [test.title]
            });
            recommendations.push("Verify URL accessibility");
            recommendations.push("Add wait for navigation");
          } else if (errorText.includes("assert")) {
            issues.push({
              type: "assertion",
              description: `Assertion failed in '${test.title}'`,
              severity: "warning",
              affectedTests: [test.title]
            });
            recommendations.push("Review assertion logic");
          } else {
            issues.push({
              type: "other",
              description: test.error.substring(0, 100),
              severity: "warning",
              affectedTests: [test.title]
            });
          }
        }
      });

    // General recommendations
    if (testResult.duration > 30000) {
      recommendations.push("Tests took longer than expected - consider optimization");
    }

    if (recommendations.length === 0) {
      recommendations.push("Review generated test code and verify assertions");
    }

    return {
      hasFailures: true,
      rootCauses: ["See issues list for detailed analysis"],
      issues,
      recommendations,
      retryStrategy: "Retry with increased timeout for timeout-related failures"
    };
  }
}
