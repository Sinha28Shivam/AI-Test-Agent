import { orchestrator } from "./orchestrator";
import { AIConfig } from "./utils/ai-config";
import { logger } from "./utils/logger";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

async function getPromptFromSource(): Promise<string> {
  // Priority 1: Command-line arguments (for flexibility)
  const cliPrompt = process.argv.slice(2).join(" ");
  if (cliPrompt) {
    logger.info("ℹ Test scenario from command-line arguments");
    return cliPrompt;
  }

  // Priority 2: YAML/JSON input file (test-input.yaml or test-input.json)
  const inputFiles = ["test-input.yaml", "test-input.json"];
  
  for (const fileName of inputFiles) {
    const filePath = path.join(process.cwd(), fileName);
    
    if (fs.existsSync(filePath)) {
      logger.info(`ℹ Reading test scenario from: ${fileName}`);
      
      try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        
        let config: any;
        if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
          config = yaml.load(fileContent) as any;
        } else if (fileName.endsWith(".json")) {
          config = JSON.parse(fileContent);
        }
        
        if (!config || !config.prompt) {
          logger.error(`✗ ${fileName} is missing 'prompt' field`);
          process.exit(1);
        }
        
        const prompt = config.prompt.trim();
        if (!prompt) {
          logger.error(`✗ ${fileName} 'prompt' field is empty`);
          process.exit(1);
        }
        
        logger.success(`✓ Loaded prompt from ${fileName}:`);
        logger.info(`\n${prompt}\n`);
        return prompt;
      } catch (error) {
        logger.error(`✗ Error reading ${fileName}: ${error}`);
        process.exit(1);
      }
    }
  }

  // Priority 3: No input provided
  logger.error("✗ No test scenario provided");
  logger.error("\nYou can provide test scenarios in 3 ways:");
  logger.error("1. Command-line: npm start \"Your test scenario here\"");
  logger.error("2. Create test-input.yaml with a 'prompt' field");
  logger.error("3. Create test-input.json with a 'prompt' field");
  logger.error("\nExample test-input.yaml:");
  logger.error("  prompt: |\n    Verify page loads at https://www.example.com");
  process.exit(1);
}

async function main(): Promise<void> {
  try {
    // Get prompt from file or CLI
    const prompt = await getPromptFromSource();

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