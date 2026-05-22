import { logger } from "../utils/logger";
import { FileManager } from "../utils/file-manager";
import { AnalysisResult, DetailedIssue } from "./ai-analyzer-agent";
import { TestResult } from "./executor-agent";
import path from "path";

export interface FinalReport {
  status: "passed" | "failed";
  pipelineStatus: "success" | "failed";
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    duration: number;
    hasFailures: boolean;
  };
  analysis: {
    rootCauses: string[];
    issues: DetailedIssue[];
    recommendations: string[];
    isFixable: boolean;
    retryStrategy?: string | undefined;
  };
  reportGeneratedAt: string;
  nextActions: string[];
}

/**
 * Enhanced Summary Agent
 * Generates comprehensive test execution report with metrics and recommendations
 */
export class SummaryAgent {
  static generateReport(
    analysis: AnalysisResult,
    testResult: TestResult,
    reportPath: string
  ): FinalReport {
    logger.info("Summary Agent is generating comprehensive report...");

    const passRate = testResult.total > 0 
      ? Math.round((testResult.passed / testResult.total) * 100) 
      : 0;

    // Determine next actions based on results
    const nextActions = this.generateNextActions(analysis, testResult, passRate);

    const report: FinalReport = {
      status: testResult.failed === 0 ? "passed" : "failed",
      pipelineStatus: "success",
      summary: {
        totalTests: testResult.total,
        passed: testResult.passed,
        failed: testResult.failed,
        skipped: testResult.skipped || 0,
        passRate,
        duration: testResult.duration,
        hasFailures: analysis.hasFailures
      },
      analysis: {
        rootCauses: analysis.rootCauses,
        issues: analysis.issues,
        recommendations: analysis.recommendations,
        isFixable: analysis.isFixable,
        retryStrategy: analysis.retryStrategy
      },
      reportGeneratedAt: new Date().toISOString(),
      nextActions
    };

    logger.success("✓ Comprehensive report generated");
    return report;
  }

  /**
   * Save report to JSON file
   */
  static saveReport(report: FinalReport, outputPath: string): void {
    logger.info(`Saving final report to: ${outputPath}`);

    try {
      const reportDir = path.dirname(outputPath);
      if (!FileManager.exists(reportDir)) {
        FileManager.write(outputPath, ""); // Create directories
      }

      FileManager.write(outputPath, JSON.stringify(report, null, 2));
      logger.success(`✓ Final report saved to ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to save report: ${error}`);
      throw error;
    }
  }

  /**
   * Print human-readable report to console
   */
  static printReport(report: FinalReport): void {
    const s = report.summary;
    const a = report.analysis;

    console.log("\n" + "█".repeat(70));
    console.log("█" + " ".repeat(68) + "█");
    console.log("█" + "  FINAL TEST EXECUTION REPORT".padEnd(68) + "█");
    console.log("█" + " ".repeat(68) + "█");
    console.log("█".repeat(70));

    console.log(`\nReport Generated: ${report.reportGeneratedAt}`);

    // Summary Section
    console.log("\n" + "-".repeat(70));
    console.log("EXECUTION SUMMARY");
    console.log("-".repeat(70));
    console.log(`Overall Status:    ${report.status.toUpperCase()}`);
    console.log(`Pipeline Status:   ${report.pipelineStatus.toUpperCase()}`);
    console.log("\nTest Metrics:");
    console.log(`  • Total Tests:   ${s.totalTests}`);
    console.log(`  • Passed:        ${s.passed}`);
    console.log(`  • Failed:        ${s.failed}`);
    console.log(`  • Skipped:       ${s.skipped}`);
    console.log(`  • Pass Rate:     ${s.passRate}%`);
    console.log(`  • Duration:      ${(s.duration / 1000).toFixed(2)}s`);

    // Issues Section
    if (a.issues.length > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("DETECTED ISSUES");
      console.log("-".repeat(70));
      a.issues.forEach((issue, idx) => {
        console.log(`\n  ${idx + 1}. ${issue.type.toUpperCase()}`);
        console.log(`     Severity: ${issue.severity}`);
        console.log(`     Description: ${issue.description}`);
        if (issue.evidence) {
          console.log(`     Evidence: ${issue.evidence.substring(0, 80)}...`);
        }
        if (issue.affectedTests.length > 0) {
          console.log(`     Affected Tests: ${issue.affectedTests.join(", ")}`);
        }
      });
    }

    // Root Causes Section
    if (a.rootCauses.length > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("ROOT CAUSES");
      console.log("-".repeat(70));
      a.rootCauses.forEach((cause) => {
        console.log(`  • ${cause}`);
      });
    }

    // Recommendations Section
    if (a.recommendations.length > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("RECOMMENDATIONS");
      console.log("-".repeat(70));
      a.recommendations.forEach((rec, idx) => {
        console.log(`  ${idx + 1}. ${rec}`);
      });
    }

    // Fixability & Retry Strategy
    console.log("\n" + "-".repeat(70));
    console.log("FIXABILITY & RETRY STRATEGY");
    console.log("-".repeat(70));
    console.log(`  Fixable by Regeneration: ${a.isFixable ? "Yes" : "No"}`);
    if (a.retryStrategy) {
      console.log(`  Retry Strategy: ${a.retryStrategy}`);
    }

    // Next Actions Section
    if (report.nextActions.length > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("RECOMMENDED NEXT ACTIONS");
      console.log("-".repeat(70));
      report.nextActions.forEach((action, idx) => {
        console.log(`  ${idx + 1}. ${action}`);
      });
    }

    console.log("\n" + "█".repeat(70) + "\n");
  }

  /**
   * Generate recommended next actions based on results
   */
  private static generateNextActions(
    analysis: AnalysisResult,
    testResult: TestResult,
    passRate: number
  ): string[] {
    const actions: string[] = [];

    if (testResult.failed === 0) {
      actions.push("✓ All tests passed - no action required");
      return actions;
    }

    if (analysis.isFixable) {
      actions.push(`Regenerate test script (${analysis.rootCauses.length} issues detected)`);
      actions.push("Re-run tests with updated script");
    } else {
      actions.push("Manual review of test failures required");
    }

    if (analysis.issues.some(i => i.type === "network")) {
      actions.push("Verify network connectivity and target URL accessibility");
    }

    if (analysis.issues.some(i => i.type === "selector-not-found")) {
      actions.push("Review and validate CSS selectors or page structure");
    }

    if (analysis.issues.some(i => i.type === "timeout")) {
      actions.push("Consider increasing timeout values for slow operations");
    }

    if (passRate > 0 && passRate < 50) {
      actions.push("Review generated test script for accuracy");
      actions.push("Run with more verbose logging to diagnose issues");
    }

    if (testResult.duration > 60000) {
      actions.push("Optimize test execution - consider running tests in parallel");
    }

    return actions;
  }
}
