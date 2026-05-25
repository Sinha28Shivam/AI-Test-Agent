import { logger } from "./utils/logger";
import { AIConfig } from "./utils/ai-config";
import { ScenarioAgent } from "./agents/scenario-agent";
import { DOMExtractorAgent } from "./agents/dom-extractor-agent";
import { AIGeneratorAgent } from "./agents/copilot-generator-agent";
import { ExecutorAgent } from "./agents/executor-agent";
import { AIAnalyzerAgent } from "./agents/ai-analyzer-agent";
import { SummaryAgent } from "./agents/summary-agent";
import { ValidatorAgent, ValidationResult } from "./agents/validator-agent";
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
    try {
      const urlsToExtract = scenarioData.allUrls.length > 0 ? scenarioData.allUrls : [scenarioData.url];
      const domSnapshots = await DOMExtractorAgent.extractAll(urlsToExtract, scenarioData.strategies);
      if (domSnapshots.length > 0) {
        scenarioData.domSnapshots = domSnapshots;
        const lastSnapshot = domSnapshots[domSnapshots.length - 1];
        if (lastSnapshot) {
          scenarioData.domSnapshot = lastSnapshot;
        }
      }
    } catch (error) {
      logger.warn(`⚠ DOM extraction failed (will continue without it): ${error}`);
    }

    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 3 & 4: Generate → Validate (with regeneration loop)");
    logger.info("=".repeat(60));

    const MAX_GEN_ATTEMPTS = 3;
    let scriptPath = "";
    let validation: Pick<ValidationResult, "overallAccuracy" | "issues"> = {
      overallAccuracy: 0,
      issues: []
    };

    for (let genAttempt = 1; genAttempt <= MAX_GEN_ATTEMPTS; genAttempt++) {
      logger.info(`\nGeneration attempt ${genAttempt}/${MAX_GEN_ATTEMPTS}`);

      try {
        scriptPath = await AIGeneratorAgent.generate(scenarioData);
        logger.success(`Generated file: ${scriptPath}`);
      } catch (genError) {
        logger.warn(`Generation attempt ${genAttempt} failed: ${genError}`);
        if (genAttempt === MAX_GEN_ATTEMPTS) {
          throw new Error(`All ${MAX_GEN_ATTEMPTS} generation attempts failed`);
        }
        continue;
      }

      validation = await ValidatorAgent.validate(
        scriptPath,
        scenarioData.scenarios.length,
        scenarioData.strategies
      );

      logger.info(`Validation Accuracy: ${validation.overallAccuracy}/10`);

      if (validation.issues.length > 0) {
        logger.warn(`Validation Issues: ${validation.issues.join(" | ")}`);
      }

      if (validation.overallAccuracy >= 7) {
        logger.success(`✓ Quality gate passed (${validation.overallAccuracy}/10)`);
        break;
      }

      if (genAttempt < MAX_GEN_ATTEMPTS) {
        logger.warn(
          `Quality too low (${validation.overallAccuracy}/10) — regenerating (attempt ${genAttempt + 1}/${MAX_GEN_ATTEMPTS})...`
        );
      } else {
        throw new Error(
          `Generated script quality too low after ${MAX_GEN_ATTEMPTS} attempts: ${validation.overallAccuracy}/10`
        );
      }
    }


    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 5: Executing Tests");
    logger.info("=".repeat(60));
    const testResult = await ExecutorAgent.execute(scriptPath);
    
    // Save raw test results
    const rawReportPath = path.join("reports", "raw", "result.json");
    ExecutorAgent.saveResults(testResult, rawReportPath);
    logger.success(`Raw results saved to ${rawReportPath}`);

    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 6: Analyzing Results");
    logger.info("=".repeat(60));
    const analysis = await AIAnalyzerAgent.analyze(testResult, scenarioData.strategies);
    logger.success("Analysis completed");

    logger.info("\n" + "=".repeat(60));
    logger.info("STEP 7: Generating Final Report");
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