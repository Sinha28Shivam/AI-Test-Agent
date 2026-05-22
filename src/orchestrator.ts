import { logger } from "./utils/logger";
import { AIConfig } from "./utils/ai-config";
import { ScenarioAgent } from "./agents/scenario-agent";
import { DOMExtractorAgent } from "./agents/dom-extractor-agent";
import { AIGeneratorAgent } from "./agents/copilot-generator-agent";
import { ExecutorAgent } from "./agents/executor-agent";
import { AIAnalyzerAgent } from "./agents/ai-analyzer-agent";
import { SummaryAgent } from "./agents/summary-agent";
import { ValidatorAgent } from "./agents/validator-agent";
import path from "path";

export interface OrchestrationResult {
  pipelineStatus: "success" | "failed";
  testStatus: "passed" | "failed" | "skipped";
  exitCode: number;
  message: string;
}

/**
 * Main Orchestrator
 * Manages full pipeline: Scenario → Generate → Validate → Execute → Analyze → Summary
 */
export async function orchestrator(prompt: string): Promise<OrchestrationResult> {
  logger.info("Starting orchestrator...");
  logger.info("Pipeline: Scenario → DOM Extract → Generate → Validate → Execute → Analyze → Summary");

  try {
    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 1: Understanding Scenario");
    logger.info("=".repeat(60));
    const scenarioData = ScenarioAgent.parse(prompt);

    logger.info("Structured scenario output:");
    console.log(JSON.stringify(scenarioData, null, 2));

    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 2: Extracting DOM Elements");
    logger.info("=".repeat(60));
    let domSnapshot = undefined;
    try {
      domSnapshot = await DOMExtractorAgent.extract(scenarioData.url);
      scenarioData.domSnapshot = domSnapshot;
    } catch (error) {
      logger.warn(`⚠ DOM extraction failed (will continue without it): ${error}`);
    }

    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 3: Generating Playwright Test Script");
    logger.info("=".repeat(60));
    const scriptPath = await AIGeneratorAgent.generate(scenarioData);
    logger.success(`Generated file: ${scriptPath}`);

    // ---------------- VALIDATOR STEP ----------------
logger.info("\n" + "=".repeat(60));
logger.info("STEP 4: Validating Generated Script");
logger.info("=".repeat(60));

const validation = await ValidatorAgent.validate(
  scriptPath,
  scenarioData.scenarios.length
);

logger.info(
  `Validation Accuracy: ${validation.overallAccuracy}/10`
);

if (validation.issues.length > 0) {
  logger.warn(
    `Validation Issues: ${validation.issues.join(" | ")}`
  );
}

if (validation.overallAccuracy < 7) {
  throw new Error(
    `Generated script quality too low: ${validation.overallAccuracy}/10`
  );
}


    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 4: Executing Tests");
    logger.info("=".repeat(60));
    const testResult = await ExecutorAgent.execute(scriptPath);
    
    // Save raw test results
    const rawReportPath = path.join("reports", "raw", "result.json");
    ExecutorAgent.saveResults(testResult, rawReportPath);
    logger.success(`Raw results saved to ${rawReportPath}`);

    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 5: Analyzing Results");
    logger.info("=".repeat(60));
    const analysis = await AIAnalyzerAgent.analyze(testResult);
    logger.success("Analysis completed");

    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 6: Generating Final Report");
    logger.info("=".repeat(60));
    const finalReportPath = path.join("reports", "final", "report.json");
    const finalReport = SummaryAgent.generateReport(analysis, testResult, rawReportPath);
    SummaryAgent.saveReport(finalReport, finalReportPath);
    SummaryAgent.printReport(finalReport);

    logger.info("\n" + "=".repeat(60));
    
    // Separate pipeline completion from test status
    logger.success("✓ Pipeline completed successfully");
    
    if (testResult.failed === 0) {
      logger.success("✓ All tests passed");
      return {
        pipelineStatus: "success",
        testStatus: "passed",
        exitCode: 0,
        message: "Pipeline and tests completed successfully"
      };
    } else {
      logger.error(`✗ ${testResult.failed} test(s) failed`);
      return {
        pipelineStatus: "success",
        testStatus: "failed",
        exitCode: 1,
        message: `Pipeline completed but ${testResult.failed}/${testResult.total} tests failed`
      };
    }

  } catch (error) {
    logger.error(`Orchestrator failed: ${error}`);
    return {
      pipelineStatus: "failed",
      testStatus: "skipped",
      exitCode: 1,
      message: `Orchestrator error: ${error}`
    };
  }
}