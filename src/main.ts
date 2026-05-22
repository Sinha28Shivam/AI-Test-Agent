import { orchestrator } from "./orchestrator";
import { AIConfig } from "./utils/ai-config";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ");

  if (!prompt) {
    logger.error("Please provide a test scenario prompt");
    logger.error("Usage: npm start \"Verify MSN site loads at https://www.msn.com\"");
    process.exit(1);
  }

  try {
    // Initialize AI providers
    logger.info("Initializing AI providers...");
    await AIConfig.initialize();

    // Run orchestrator
    const result = await orchestrator(prompt);

    // Print final status
    logger.info("\n" + "=".repeat(60));
    logger.info("FINAL EXECUTION STATUS");
    logger.info("=".repeat(60));
    logger.info(`Pipeline Status: ${result.pipelineStatus}`);
    logger.info(`Test Status: ${result.testStatus}`);
    logger.info(`Message: ${result.message}`);
    logger.info("=".repeat(60));

    process.exit(result.exitCode);
  } catch (error) {
    logger.error(`Application error: ${error}`);
    process.exit(1);
  }
}

main();