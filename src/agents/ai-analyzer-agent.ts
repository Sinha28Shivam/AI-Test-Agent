/**
 * AI-Agnostic Analyzer Agent
 * Provides intelligent RCA detection with both AI and heuristic analysis
 */

import { logger } from "../utils/logger";
import { AIConfig } from "../utils/ai-config";
import { TestResult } from "./executor-agent";
import { ScenarioStrategy } from "./scenario-strategy";

export interface DetailedIssue {
  type: "timeout" | "selector-not-found" | "navigation" | "assertion" | "title-mismatch" | "flaky" | "network" | "invalid-code" | "other";
  description: string;
  severity: "critical" | "warning" | "info";
  affectedTests: string[];
  evidence?: string;
}

export interface AnalysisResult {
  hasFailures: boolean;
  rootCauses: string[];
  issues: DetailedIssue[];
  recommendations: string[];
  retryStrategy?: string;
  suggestedFixes?: string[];
  isFixable: boolean;
}

/**
 * RCA Detection Patterns
 */
const RCA_PATTERNS = {
  timeout: {
    pattern: /timeout|exceeded|timed out|wait.*longer/i,
    type: "timeout" as const,
    severity: "critical" as const
  },
  selector: {
    pattern: /selector|locator|element.*not.*found|no element|find.*failed/i,
    type: "selector-not-found" as const,
    severity: "critical" as const
  },
  navigation: {
    pattern: /navigate|redirect|url|goto|cannot.*reach|connection.*refused/i,
    type: "navigation" as const,
    severity: "critical" as const
  },
  assertion: {
    pattern: /assert|expect|equal|toHave|toBe.*failed|not.*equal/i,
    type: "assertion" as const,
    severity: "warning" as const
  },
  title: {
    pattern: /title|name.*mismatch|expected.*got/i,
    type: "title-mismatch" as const,
    severity: "warning" as const
  },
  network: {
    pattern: /network|connection|http|dns|socket|fetch.*failed/i,
    type: "network" as const,
    severity: "critical" as const
  },
  invalid: {
    pattern: /syntax|parse.*error|invalid|undefined.*not.*function|ReferenceError/i,
    type: "invalid-code" as const,
    severity: "critical" as const
  }
};

export class AIAnalyzerAgent {
  /**
   * Main analysis method using AI provider.
   * Strategies enrich the analysis with known failure causes per scenario type.
   */
  static async analyze(
    testResult: TestResult,
    strategies: ScenarioStrategy[] = []
  ): Promise<AnalysisResult> {
    logger.info("AI Analyzer Agent is running...");

    if (strategies.length > 0) {
      logger.info(`  Scenario-aware analysis for: ${strategies.map(s => s.type).join(", ")}`);
    }

    if (testResult.failed === 0) {
      logger.success("✓ No failures detected");
      return {
        hasFailures: false,
        rootCauses: [],
        issues: [],
        recommendations: ["All tests passed successfully. No action needed."],
        retryStrategy: "N/A",
        isFixable: false
      };
    }

    try {
      // Try AI analysis first
      logger.info(`Analyzing ${testResult.failed} test failure(s)...`);
      const aiAnalysis = await this.getAIAnalysis(testResult, strategies);

      if (aiAnalysis) {
        return aiAnalysis;
      }
    } catch (error) {
      logger.warn(`⚠ AI analysis failed: ${error}. Using fallback...`);
    }

    // Fallback to heuristic analysis
    logger.info("Using heuristic RCA detection...");
    return this.getHeuristicAnalysis(testResult, strategies);
  }

  /**
   * Get analysis from AI provider, enriched with scenario-known failure causes.
   */
  private static async getAIAnalysis(
    testResult: TestResult,
    strategies: ScenarioStrategy[]
  ): Promise<AnalysisResult | null> {
    try {
      const provider = AIConfig.getAnalyzerProvider();
      const failureDetails = this.extractFailureDetails(testResult);

      const scenarioContext = strategies.length > 0
        ? `\nScenario Context (known failure causes per scenario):\n` +
          strategies
            .map(
              (s) =>
                `[${s.type}]\n` +
                `  Common causes: ${s.analysis.commonFailureCauses.join("; ")}\n` +
                `  Fix suggestions: ${s.analysis.fixSuggestions.join("; ")}`
            )
            .join("\n")
        : "";

      const prompt = `You are a Playwright test automation expert. Analyze these test failures and provide root cause analysis (RCA).

${failureDetails}${scenarioContext}

Test Execution Metrics:
- Total Tests: ${testResult.total}
- Passed: ${testResult.passed}
- Failed: ${testResult.failed}
- Duration: ${testResult.duration}ms

For each failure, identify:
1. Root cause (timeout, selector, navigation, assertion, flaky, network, invalid code, other)
2. Severity (critical/warning/info)
3. Is it fixable by regenerating the script?
4. Recommended fix

Return JSON only (no markdown):
{
  "rootCauses": ["cause1", "cause2"],
  "isFixable": true/false,
  "issues": [
    {
      "type": "timeout|selector-not-found|navigation|assertion|title-mismatch|flaky|network|invalid-code|other",
      "description": "...",
      "severity": "critical|warning|info",
      "affectedTests": ["test1"]
    }
  ],
  "recommendations": ["rec1", "rec2"],
  "suggestedFixes": ["fix1"],
  "retryStrategy": "..."
}`;

      const response = await provider.generate(prompt);

      if (!response.success || !response.data) {
        logger.warn("⚠ AI provider returned empty response");
        return null;
      }

      // Parse JSON response
      try {
        const jsonMatch = response.data.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          logger.warn("⚠ No JSON found in AI response");
          return null;
        }

        const analysis = JSON.parse(jsonMatch[0]);
        logger.success(`✓ AI analysis completed (provider: ${response.provider})`);

        return {
          hasFailures: true,
          rootCauses: analysis.rootCauses || [],
          issues: analysis.issues || [],
          recommendations: analysis.recommendations || [],
          suggestedFixes: analysis.suggestedFixes,
          retryStrategy: analysis.retryStrategy,
          isFixable: analysis.isFixable !== false
        };
      } catch (parseError) {
        logger.warn(`⚠ Failed to parse AI response as JSON: ${parseError}`);
        return null;
      }
    } catch (error) {
      logger.warn(`⚠ AI analysis error: ${error}`);
      return null;
    }
  }

  /**
   * Heuristic RCA detection (fallback when AI is unavailable).
   * Uses scenario-strategy known failure causes when available.
   */
  private static getHeuristicAnalysis(
    testResult: TestResult,
    strategies: ScenarioStrategy[] = []
  ): AnalysisResult {
    logger.info("Running heuristic pattern matching...");

    const issues: DetailedIssue[] = [];
    const recommendations = new Set<string>();
    let isFixable = true;

    // Analyze each failed test
    testResult.tests
      .filter((t) => t.status === "failed")
      .forEach((test) => {
        if (!test.error) return;

        const errorText = test.error;
        let detectedType: typeof RCA_PATTERNS[keyof typeof RCA_PATTERNS]["type"] | null = null;
        let detectedSeverity: "critical" | "warning" | "info" = "warning";
        let evidence = "";

        // Check each RCA pattern
        for (const [patternName, patternData] of Object.entries(RCA_PATTERNS)) {
          if (patternData.pattern.test(errorText)) {
            detectedType = patternData.type;
            detectedSeverity = patternData.severity;
            evidence = errorText.substring(0, 150);
            logger.info(`  Detected ${patternName}: ${test.title}`);
            break;
          }
        }

        if (detectedType) {
          issues.push({
            type: detectedType,
            description: `${detectedType.replace(/-/g, " ")}: ${test.title}`,
            severity: detectedSeverity,
            affectedTests: [test.title],
            evidence
          });

          // Add recommendations based on type
          switch (detectedType) {
            case "timeout":
              recommendations.add("Increase timeout for slow operations");
              recommendations.add("Check if elements take time to load");
              recommendations.add("Consider adding waitForLoadState('networkidle')");
              isFixable = true;
              break;
            case "selector-not-found":
              recommendations.add("Review and improve CSS selectors");
              recommendations.add("Use role-based locators for better stability");
              recommendations.add("Verify elements exist before interaction");
              isFixable = true;
              break;
            case "navigation":
              recommendations.add("Verify URL is accessible");
              recommendations.add("Check network connectivity");
              recommendations.add("Retry with better error handling");
              isFixable = true;
              break;
            case "assertion":
              recommendations.add("Review assertion logic");
              recommendations.add("Update expected values if needed");
              isFixable = true;
              break;
            case "invalid-code":
              recommendations.add("Review generated TypeScript code");
              recommendations.add("Fix syntax errors in generated script");
              isFixable = true;
              break;
            case "network":
              recommendations.add("Check network connectivity");
              recommendations.add("Verify target domain is reachable");
              recommendations.add("Consider adding retry logic");
              isFixable = false;
              break;
          }
        } else {
          // Unknown error
          issues.push({
            type: "other",
            description: `Unknown error: ${test.title}`,
            severity: "warning",
            affectedTests: [test.title],
            evidence: errorText.substring(0, 100)
          });
          recommendations.add("Review test logs for details");
        }
      });

    // Duration-based recommendations
    if (testResult.duration > 30000) {
      recommendations.add("Tests took longer than expected - consider parallelization");
    }

    // Inject scenario-specific fix suggestions if strategies are available
    if (strategies.length > 0) {
      logger.info("Applying scenario-specific fix suggestions...");
      strategies.forEach((s) => {
        s.analysis.fixSuggestions.forEach((fix) => recommendations.add(`[${s.type}] ${fix}`));
      });

      // If no issues were matched by generic patterns, add scenario known causes
      if (issues.length === 0) {
        strategies.forEach((s) => {
          s.analysis.commonFailureCauses.forEach((cause) => {
            issues.push({
              type: "other",
              description: `[${s.type}] Possible cause: ${cause}`,
              severity: "warning",
              affectedTests: testResult.tests
                .filter((t) => t.status === "failed")
                .map((t) => t.title),
            });
          });
        });
      }
    }

    return {
      hasFailures: true,
      rootCauses: issues.map(i => i.type),
      issues,
      recommendations: Array.from(recommendations),
      retryStrategy: isFixable ? "Regenerate script and retry" : "Manual review required",
      isFixable
    };
  }

  /**
   * Extract failure details from test result
   */
  private static extractFailureDetails(testResult: TestResult): string {
    const failedTests = testResult.tests.filter((t) => t.status === "failed");

    let details = "Failed Tests:\n";
    failedTests.forEach((test, idx) => {
      details += `\n${idx + 1}. ${test.title}\n`;
      if (test.error) {
        details += `   Error: ${test.error.substring(0, 300)}...\n`;
      }
    });

    return details;
  }
}
