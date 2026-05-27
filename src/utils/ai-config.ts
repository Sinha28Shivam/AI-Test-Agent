/**
 * AI Provider Configuration & Factory
 * Centralized provider management and swapping
 */

import { AIProvider } from "./ai-provider-interface";
import { CopilotProvider } from "./copilot-provider";
import { logger } from "./logger";

export class AIConfig {
  private static generatorProvider: AIProvider;
  private static analyzerProvider: AIProvider;
  private static initialized = false;

  /**
   * Initialize AI providers (call once at app startup)
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      // Default: Copilot for both generation and analysis
      this.generatorProvider = new CopilotProvider({
        name: "copilot",
        enabled: true,
        retryAttempts: 3,
        retryDelayMs: 1000,
        timeoutMs: 180000  // Increased from 60000ms (1 min) to 180000ms (3 min) for complex prompt handling
      });

      this.analyzerProvider = new CopilotProvider({
        name: "copilot",
        enabled: true,
        retryAttempts: 2,
        retryDelayMs: 500,
        timeoutMs: 45000
      });

      // Verify providers are available
      logger.info("Checking AI provider availability...");
      const generatorOk = await this.generatorProvider.isAvailable();
      
      logger.info(`Provider availability check result: ${generatorOk}`);
      
      if (!generatorOk) {
        logger.warn("⚠ Provider availability check failed, but attempting to proceed anyway...");
      }

      logger.success("✓ AI providers initialized successfully");
      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize AI providers: ${error}`);
      throw error;
    }
  }

  /**
   * Set custom generator provider (Claude, OpenAI, etc.)
   */
  static setGeneratorProvider(provider: AIProvider) {
    this.generatorProvider = provider;
  }

  /**
   * Set custom analyzer provider
   */
  static setAnalyzerProvider(provider: AIProvider) {
    this.analyzerProvider = provider;
  }

  /**
   * Get current generator provider
   */
  static getGeneratorProvider(): AIProvider {
    if (!this.generatorProvider) {
      throw new Error("AI providers not initialized. Call AIConfig.initialize() first.");
    }
    return this.generatorProvider;
  }

  /**
   * Get current analyzer provider
   */
  static getAnalyzerProvider(): AIProvider {
    if (!this.analyzerProvider) {
      throw new Error("AI providers not initialized. Call AIConfig.initialize() first.");
    }
    return this.analyzerProvider;
  }

  /**
   * Reset to defaults (useful for testing)
   */
  static reset() {
    this.generatorProvider = null as any;
    this.analyzerProvider = null as any;
    this.initialized = false;
  }
}
