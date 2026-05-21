import { logger } from "../utils/logger";
import { FileManager } from "../utils/file-manager";
import { AnalysisResult } from "./copilot-analyzer-agent";
import path from "path";

export interface TestSummary {
  hasFailures: boolean;
  rootCauses: string[];
  recommendations: string[];
  retryStrategy?: string | undefined;
  suggestedFixes?: string[] | undefined;
}

export interface FinalReport {
  pipeline: "Generate → Execute → Analyze";
  summary: TestSummary;
  reportGeneratedAt: string;
  reportPath: string;
}

export class SummaryAgent {
  static generateReport(analysis: AnalysisResult, reportPath: string): FinalReport {
    logger.info("Summary Agent is running...");

    const summary: TestSummary = {
      hasFailures: analysis.hasFailures,
      rootCauses: analysis.rootCauses,
      recommendations: analysis.recommendations,
      retryStrategy: analysis.retryStrategy,
      suggestedFixes: analysis.suggestedFixes
    };

    const report: FinalReport = {
      pipeline: "Generate → Execute → Analyze",
      summary,
      reportGeneratedAt: new Date().toISOString(),
      reportPath
    };

    logger.success("Final report generated");
    return report;
  }

  static saveReport(report: FinalReport, outputPath: string): void {
    logger.info(`Saving final report to: ${outputPath}`);

    try {
      const reportDir = path.dirname(outputPath);
      if (!FileManager.exists(reportDir)) {
        FileManager.write(outputPath, ""); // Create directories
      }

      FileManager.write(outputPath, JSON.stringify(report, null, 2));
      logger.success(`Final report saved to ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to save report: ${error}`);
      throw error;
    }
  }

  static printReport(report: FinalReport): void {
    console.log("\n" + "█".repeat(70));
    console.log("█" + " ".repeat(68) + "█");
    console.log("█" + "  FINAL TEST EXECUTION REPORT".padEnd(68) + "█");
    console.log("█" + " ".repeat(68) + "█");
    console.log("█".repeat(70));

    console.log(`\nPipeline: ${report.pipeline}`);
    console.log(`Report Generated: ${report.reportGeneratedAt}`);
    console.log(`Report Location: ${report.reportPath}`);

    const s = report.summary;
    console.log("\n" + "-".repeat(70));
    console.log("EXECUTION RESULTS");
    console.log("-".repeat(70));
    console.log(`Status: ${s.hasFailures ? "FAILED" : "PASSED"}`);
    
    if (s.rootCauses && s.rootCauses.length > 0) {
      console.log("\nRoot Causes:");
      s.rootCauses.forEach((cause) => console.log(`  • ${cause}`));
    }

    console.log("\n" + "-".repeat(70));
    console.log("RECOMMENDATIONS");
    console.log("-".repeat(70));

    if (s.recommendations && s.recommendations.length > 0) {
      s.recommendations.forEach((rec, idx) => console.log(`  ${idx + 1}. ${rec}`));
    } else {
      console.log("  No recommendations at this time");
    }

    if (s.retryStrategy) {
      console.log(`\nRetry Strategy: ${s.retryStrategy}`);
    }

    if (s.suggestedFixes && s.suggestedFixes.length > 0) {
      console.log("\nSuggested Fixes:");
      s.suggestedFixes.forEach((fix, idx) => console.log(`  ${idx + 1}. ${fix}`));
    }

    console.log("\n" + "█".repeat(70) + "\n");
  }
}
