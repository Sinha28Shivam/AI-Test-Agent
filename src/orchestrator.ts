import { logger } from "./utils/logger";
import { ScenarioAgent } from "./agents/scenario-agent";
import { CopilotGeneratorAgent } from "./agents/copilot-generator-agent";
import { ExecutorAgent } from "./agents/executor-agent";
import { CopilotAnalyzerAgent } from "./agents/copilot-analyzer-agent";
import { SummaryAgent } from "./agents/summary-agent";
import path from "path";

export async function orchestrator(prompt: string): Promise<void> {
    logger.info("Starting orchestrator...");
    logger.info("Pipeline: Scenario → Copilot Generate → Execute → Copilot Analyze → Summary");

    try {
        logger.info("\n" + "=".repeat(60));
        logger.info("STEP 1: Understanding Scenario");
        logger.info("=".repeat(60));
        const scenarioData = ScenarioAgent.parse(prompt);

        logger.info("Structured scenario output:");
        console.log(JSON.stringify(scenarioData, null, 2));

        logger.info("\n" + "=".repeat(60));
        logger.info("STEP 2: Generating Playwright Test Script (Copilot CLI)");
        logger.info("=".repeat(60));
        const scriptPath = await CopilotGeneratorAgent.generate(scenarioData);
        logger.success(`Generated file: ${scriptPath}`);

        logger.info("\n" + "=".repeat(60));
        logger.info("STEP 3: Executing Tests");
        logger.info("=".repeat(60));
        const testResult = await ExecutorAgent.execute(scriptPath);
        logger.success("Test execution completed");

        // Save raw test results
        const rawReportPath = path.join("reports", "raw", "result.json");
        ExecutorAgent.saveResults(testResult, rawReportPath);
        logger.success(`Raw results saved to ${rawReportPath}`);

        logger.info("\n" + "=".repeat(60));
        logger.info("STEP 4: Analyzing Results (Copilot CLI)");
        logger.info("=".repeat(60));
        const analysis = await CopilotAnalyzerAgent.analyze(testResult);
        logger.success("Analysis completed by Copilot CLI");

        logger.info("\n" + "=".repeat(60));
        logger.info("STEP 5: Generating Final Report");
        logger.info("=".repeat(60));
        const finalReportPath = path.join("reports", "final", "report.json");
        const finalReport = SummaryAgent.generateReport(analysis, rawReportPath);
        SummaryAgent.saveReport(finalReport, finalReportPath);
        SummaryAgent.printReport(finalReport);

        logger.info("\n" + "=".repeat(60));
        logger.success("PIPELINE COMPLETED SUCCESSFULLY");
        logger.info("=".repeat(60));
        logger.info(`Raw Report: ${rawReportPath}`);
        logger.info(`Final Report: ${finalReportPath}`);

    } catch (error) {
        logger.error(`Orchestrator failed: ${error}`);
        throw error;
    }
}