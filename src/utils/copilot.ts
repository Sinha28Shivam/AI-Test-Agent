import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export class Copilot {
  static async ask(prompt: string): Promise<string> {
    logger.info("Calling GitHub Copilot CLI with prompt...");
    logger.info(`Prompt preview: ${prompt.substring(0, 150)}...`);

    const cleanPrompt = prompt.replace(/\r?\n/g, " ").trim();

    try {
      // Create a temporary prompt file to avoid command line length issues
      const tempDir = path.join(process.cwd(), ".temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const promptFile = path.join(tempDir, `prompt-${Date.now()}.txt`);
      fs.writeFileSync(promptFile, cleanPrompt, "utf-8");

      logger.info(`Prompt saved to temporary file: ${promptFile}`);

      // Try to call Copilot CLI with the prompt from stdin
      const result = await new Promise<string>((resolve, reject) => {
        const child = require("child_process").spawn("copilot", [], {
          shell: true,
          stdio: ["pipe", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        const timeout = setTimeout(() => {
          child.kill();
          logger.error("Copilot CLI timeout after 60 seconds");
          reject(new Error("Copilot CLI timeout"));
        }, 60000);

        if (child.stdout) {
          child.stdout.on("data", (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;
            if (chunk.length > 0) {
              logger.info(`[COPILOT] ${chunk.substring(0, 80)}`);
            }
          });
        }

        if (child.stderr) {
          child.stderr.on("data", (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            logger.warn(`[COPILOT ERR] ${chunk.substring(0, 80)}`);
          });
        }

        child.on("close", (code: number) => {
          clearTimeout(timeout);

          // Clean up temp file
          try {
            if (fs.existsSync(promptFile)) {
              fs.unlinkSync(promptFile);
            }
          } catch (e) {
            logger.warn(`Failed to delete temporary file: ${promptFile}`);
          }

          if (code === 0 || code === null) {
            const result = stdout.trim();
            if (result) {
              logger.success(`Copilot response received (${result.length} chars)`);
              resolve(result);
            } else {
              logger.error("Copilot returned empty output");
              reject(new Error("Copilot CLI returned empty response"));
            }
          } else {
            logger.error(`Copilot exited with code ${code}`);
            reject(new Error(`Copilot CLI failed with code ${code}: ${stderr}`));
          }
        });

        child.on("error", (err: Error) => {
          clearTimeout(timeout);
          logger.error(`Failed to spawn Copilot: ${err.message}`);
          reject(err);
        });

        // Write prompt to stdin
        if (child.stdin) {
          child.stdin.write(cleanPrompt + "\n");
          child.stdin.end();
        }
      });

      return result;
    } catch (error) {
      logger.error(`Copilot.ask() failed: ${error}`);
      throw error;
    }
  }
}