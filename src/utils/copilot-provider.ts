/**
 * Robust Copilot AI Provider Implementation
 * Stable child_process integration with retry logic
 */

import { spawn, execSync } from "child_process";
import { AIProvider, AIResponse, AIProviderConfig } from "./ai-provider-interface";
import { logger } from "./logger";
import path from "path";

export class CopilotProvider implements AIProvider {
  name: string = "copilot";
  config: AIProviderConfig;
  private static loaderPath: string | null = null;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Resolve global npm copilot loader path
   */
  private getLoaderPath(): string {
    if (CopilotProvider.loaderPath) return CopilotProvider.loaderPath;

    let npmRoot = "";
    try {
      npmRoot = execSync("npm root -g").toString().trim();
    } catch (e) {
      npmRoot = path.join(process.env.APPDATA || "", "npm", "node_modules");
    }

    CopilotProvider.loaderPath = path.join(npmRoot, "@github", "copilot", "npm-loader.js");
    return CopilotProvider.loaderPath;
  }

  /**
   * Check if Copilot CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const loader = this.getLoaderPath();
        const child = spawn("node", [loader, "--version"], {
          stdio: ["pipe", "pipe", "pipe"],
          shell: false
        });

        const timeout = setTimeout(() => {
          child.kill();
          resolve(true);
        }, 5000);

        child.on("error", () => {
          clearTimeout(timeout);
          resolve(false);
        });

        child.on("close", (code) => {
          clearTimeout(timeout);
          resolve(code === 0);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Generate code using Copilot with retry logic
   */
  async generate(prompt: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, "generate");
  }

  /**
   * Analyze data using Copilot with retry logic
   */
  async analyze(prompt: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, "analyze");
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    prompt: string,
    operation: "generate" | "analyze"
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const maxAttempts = this.config.retryAttempts || (operation === "generate" ? 3 : 2);
    let lastError: string = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`[${this.name}] ${operation} attempt ${attempt}/${maxAttempts}...`);

        const result = await this.executeCommand(prompt);

        if (result.success) {
          logger.success(`✓ ${operation} succeeded on attempt ${attempt}`);
          return {
            ...result,
            duration: Date.now() - startTime,
            provider: this.name
          };
        }

        lastError = result.error || "Unknown error";

        if (attempt < maxAttempts) {
          const delay = (this.config.retryDelayMs || 1000) * attempt;
          logger.warn(`⚠ Attempt ${attempt} failed: ${lastError}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (error) {
        lastError = String(error);

        if (attempt < maxAttempts) {
          const delay = (this.config.retryDelayMs || 1000) * attempt;
          logger.warn(`⚠ Error on attempt ${attempt}: ${lastError}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    const duration = Date.now() - startTime;
    return {
      success: false,
      error: `${operation} failed after ${maxAttempts} attempts: ${lastError}`,
      provider: this.name,
      duration
    };
  }

  /**
   * Execute Copilot command with stable process handling
   */
  private executeCommand(prompt: string): Promise<AIResponse> {
    return new Promise((resolve) => {
      const timeout = this.config.timeoutMs || 60000; // Increase default timeout to 60s for full code generation

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const loader = this.getLoaderPath();

      // Spawn Node directly on npm-loader with shell: false.
      // This bypasses cmd.exe/powershell string escaping and length limit problems entirely.
      const child = spawn(
        "node",
        [loader, "-p", prompt, "--model", "auto"],
        {
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
          env: process.env
        }
      );

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeout);

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        clearTimeout(timeoutHandle);

        if (timedOut) {
          return resolve({
            success: false,
            error: `Execution timeout after ${timeout}ms`,
            provider: this.name,
            duration: timeout
          });
        }

        if (code !== 0) {
          return resolve({
            success: false,
            error: stderr || `Copilot exited with code ${code}`,
            provider: this.name,
            duration: 0
          });
        }

        const result = stdout.trim();

        if (!result) {
          return resolve({
            success: false,
            error: "Copilot returned empty response",
            provider: this.name,
            duration: 0
          });
        }

        resolve({
          success: true,
          data: result,
          provider: this.name,
          duration: 0
        });
      });

      child.on("error", (error) => {
        clearTimeout(timeoutHandle);

        resolve({
          success: false,
          error: error.message,
          provider: this.name,
          duration: 0
        });
      });
    });
  }
}
