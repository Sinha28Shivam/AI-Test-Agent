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
    logger.info("STEP 3, 4 & 5: Generate → Validate → Execute Loop (Self-Healing)");
    logger.info("=".repeat(60));

    const MAX_GEN_ATTEMPTS = 3;
    let scriptPath = "";
    let testResult: any = null;
    let errorFeedbackContext = "";

    for (let genAttempt = 1; genAttempt <= MAX_GEN_ATTEMPTS; genAttempt++) {
      logger.info(`\nPipeline Attempt ${genAttempt}/${MAX_GEN_ATTEMPTS}`);

      try {
        // Generate test script, passing error feedback if a previous attempt failed
        scriptPath = await AIGeneratorAgent.generate(scenarioData, errorFeedbackContext || undefined);
        logger.success(`Generated file: ${scriptPath}`);
      } catch (genError) {
        logger.warn(`Generation attempt ${genAttempt} failed: ${genError}`);
        if (isAuthenticationError(genError)) {
          throw genError;
        }
        if (genAttempt === MAX_GEN_ATTEMPTS) {
          throw new Error(`All ${MAX_GEN_ATTEMPTS} generation attempts failed`);
        }
        continue;
      }

      // Run static validations (syntax, imports, basic pattern checks)
      const validation = await ValidatorAgent.validate(
        scriptPath,
        scenarioData.scenarios.length,
        scenarioData.strategies
      );

      logger.info(`Validation Accuracy Score: ${validation.overallAccuracy}/10`);
      if (validation.overallAccuracy < 7) {
        if (genAttempt < MAX_GEN_ATTEMPTS) {
          logger.warn(`Quality too low (${validation.overallAccuracy}/10) — correcting and regenerating...`);
          errorFeedbackContext = `Static validation failed. Issues: ${validation.issues.join("; ")}`;
          continue;
        } else {
          throw new Error(
            `Generated script quality too low after ${MAX_GEN_ATTEMPTS} attempts: ${validation.overallAccuracy}/10`
          );
        }
      }

      // Execute tests
      logger.info(`Executing tests for validation check (Attempt ${genAttempt})...`);
      try {
        testResult = await ExecutorAgent.execute(scriptPath);
        
        if (testResult.failed === 0) {
          logger.success(`✓ Tests passed successfully on attempt ${genAttempt}`);
          break;
        }

        // Test failed execution - retrieve the errors to heal the next attempt
        const failedTestLogs = testResult.tests
          .filter((t: any) => t.status === "failed")
          .map((t: any) => `Test "${t.title}" failed with error: ${t.error}`)
          .join("\n");

        logger.warn(`⚠ Test execution failed at runtime:\n${failedTestLogs}`);
        
        if (genAttempt < MAX_GEN_ATTEMPTS) {
          logger.warn(`Initiating self-healing loop: feeding failure logs back to generator...`);
          errorFeedbackContext = `The generated test script failed during runtime execution with the following errors:\n${failedTestLogs}\n\nPlease inspect the code and element selectors, correct the locator logic, ensure dynamic element visibility is properly awaited, and regenerate the script.`;
        } else {
          logger.error(`Self-healing threshold reached. Failed to solve issues after ${MAX_GEN_ATTEMPTS} runs.`);
        }
      } catch (execError) {
        logger.error(`Execution error encountered: ${execError}`);
        if (genAttempt < MAX_GEN_ATTEMPTS) {
          errorFeedbackContext = `Execution failed with subprocess crash error: ${execError}`;
        } else {
          throw execError;
        }
      }
    }

    // Save raw test results
    const rawReportPath = path.join("reports", "raw", "result.json");
    if (testResult) {
      ExecutorAgent.saveResults(testResult, rawReportPath);
      logger.success(`Raw results saved to ${rawReportPath}`);
    }

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
    
    if (testResult && testResult.failed === 0) {
      logger.success("✓ All tests passed");
      return {
        pipelineStatus: "success",
        testStatus: "passed",
        exitCode: 0,
        message: "Pipeline and tests completed successfully"
      };
    } else {
      const failedCount = testResult ? testResult.failed : 1;
      const totalCount = testResult ? testResult.total : 1;
      logger.error(`✗ ${failedCount} test(s) failed`);
      return {
        pipelineStatus: "success",
        testStatus: "failed",
        exitCode: 1,
        message: `Pipeline completed but ${failedCount}/${totalCount} tests failed`
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

function isAuthenticationError(error: unknown): boolean {
  return /No authentication information found|COPILOT_GITHUB_TOKEN|GH_TOKEN|GITHUB_TOKEN|gh auth login/i.test(String(error));
}
