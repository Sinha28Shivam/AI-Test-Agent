import { logger } from "../utils/logger";
import { DOMSnapshot } from "./dom-types";
import { ScenarioStrategy, getStrategiesForScenarios } from "./scenario-strategy";

export type ScenarioResult = {
  url: string;        // primary test URL (last URL found in prompt)
  allUrls: string[];  // all URLs found in prompt, in order
  scenarios: string[];
  strategies: ScenarioStrategy[];
  rawPrompt?: string;
  actionKeywords?: string[];
  domSnapshot?: DOMSnapshot;
  domSnapshots?: DOMSnapshot[];  // snapshots for ALL visited URLs
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
    
    // Extract all URLs; use the last one as the primary test target
    // (the final URL in the prompt is typically the most specific test destination)
    const allUrls = [...prompt.matchAll(/https?:\/\/[^\s,'"]+/g)].map(m => m[0]);
    const url = allUrls.length > 0 ? allUrls[allUrls.length - 1]! : "";
    
    // Extract scenarios using NLP
    const scenarios = this.extractScenarios(prompt);

    // Extract detected keywords
    const lowerPrompt = prompt.toLowerCase();
    const actionKeywords = Object.keys(this.KEYWORD_MAP).filter(keyword => lowerPrompt.includes(keyword));

    const finalScenarios = scenarios.length > 0 ? scenarios : ["generic-test"];
    const strategies = getStrategiesForScenarios(finalScenarios);

    logger.success("✓ Scenario parsing completed");
    logger.info(`  URL: ${url}`);
    logger.info(`  Scenarios: ${finalScenarios.join(", ")}`);
    logger.info(`  Strategies loaded: ${strategies.map(s => s.type).join(", ")}`);
    strategies.forEach(s => logger.info(`    → [${s.type}] ${s.description}`));

    if (allUrls.length > 1) {
      logger.info(`  Multiple URLs found: ${allUrls.join(" → ")}`);
      logger.info(`  Primary test target (last URL): ${url}`);
    }

    const result: ScenarioResult = {
      url,
      allUrls,
      scenarios: finalScenarios,
      strategies,
      rawPrompt: prompt
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