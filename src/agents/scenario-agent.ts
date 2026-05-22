import { logger } from "../utils/logger";
import { DOMSnapshot } from "./dom-types";

export type ScenarioResult = {
  url: string;
  scenarios: string[];
  actionKeywords?: string[];
  domSnapshot?: DOMSnapshot;
};

/**
 * Enhanced Scenario Agent with NLP keyword extraction
 * Parses natural language prompts into structured test scenarios
 */
export class ScenarioAgent {
  /**
   * Keyword to scenario mapping
   * Supports multiple keywords per scenario for flexibility
   */
  private static readonly KEYWORD_MAP: Record<string, string> = {
    // Authentication
    "login": "authentication",
    "sign in": "authentication",
    "signin": "authentication",
    "log in": "authentication",
    "signup": "registration",
    "sign up": "registration",
    "register": "registration",
    "logout": "sign-out",
    "log out": "sign-out",
    "forgot password": "password-recovery",
    "forgot-password": "password-recovery",
    "reset password": "password-recovery",
    
    // Page behavior
    "load": "page-load",
    "visible": "visibility-check",
    "display": "visibility-check",
    "render": "visibility-check",
    
    // Navigation
    "navigate": "navigation",
    "redirect": "navigation",
    "routing": "navigation",
    "navigation": "navigation",
    
    // Interaction
    "click": "interaction",
    "submit": "form-submission",
    "form": "form-submission",
    "search": "search-functionality",
    "scroll": "scroll-behavior",
    
    // Validation
    "validate": "validation",
    "verify": "validation",
    "check": "validation",
    "assert": "validation",
    
    // UI Elements
    "modal": "modal-interaction",
    "popup": "modal-interaction",
    "dialog": "modal-interaction",
    "error": "error-handling",
    "alert": "error-handling",
    "message": "message-handling"
  };

  static parse(prompt: string): ScenarioResult {
    logger.info("Scenario Agent is running...");
    
    // Extract URL
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : "";
    
    // Extract scenarios using NLP
    const scenarios = this.extractScenarios(prompt);

    // Extract detected keywords
    const lowerPrompt = prompt.toLowerCase();
    const actionKeywords = Object.keys(this.KEYWORD_MAP).filter(keyword => lowerPrompt.includes(keyword));

    logger.success("✓ Scenario parsing completed");
    logger.info(`  URL: ${url}`);
    logger.info(`  Scenarios: ${scenarios.join(", ")}`);

    const result: ScenarioResult = {
      url,
      scenarios: scenarios.length > 0 ? scenarios : ["generic-test"]
    };

    if (actionKeywords.length > 0) {
      result.actionKeywords = actionKeywords;
    }

    return result;
  }

  /**
   * Extract scenarios from natural language prompt using keyword matching
   */
  private static extractScenarios(prompt: string): string[] {
    const lowerPrompt = prompt.toLowerCase();
    const detectedScenarios = new Set<string>();

    // Split prompt into words and phrases for matching
    const words = lowerPrompt.split(/[\s\-_]+/);
    
    // Check each keyword in our map
    for (const keyword of Object.keys(this.KEYWORD_MAP)) {
  if (lowerPrompt.includes(keyword)) {
    const scenario = this.KEYWORD_MAP[keyword];

    if (scenario) {
      detectedScenarios.add(scenario);
      logger.info(
        `✓ Detected keyword: "${keyword}" → scenario: "${scenario}"`
      );
    }
  }
}

    // Return unique scenarios, sorted alphabetically for consistency
    return Array.from(detectedScenarios).sort();
  }
}