import { orchestrator } from "./orchestrator";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
    const prompt = process.argv.slice(2).join(" ");

    if(!prompt) {
        logger.error("Please provide a test scenario prompt");
        process.exit(1);
    }

    await orchestrator(prompt);
}

main().catch((error) => {
    logger.error(String(error));
});