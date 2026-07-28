import llmClient from '../core/LlmClient.js';
import promptLoader from '../config/PromptLoader.js';
import fs from 'fs/promises';
import mcpBridgePool from '../core/MCPBridgePool.js';

class HealingAgent {
  constructor() {
    this.initialized = false;
  }

  async init() {
    // Standard initialization if needed, keeping it consistent with other agents
    this.initialized = true;
  }

  /**
   * Heals a failing Playwright spec file by querying the LLM with the error and current page state.
   */
  async heal(specPath, errorMessage, domain, targetUrl) {
    console.log(`[HealingAgent] Attempting to heal script: ${specPath}`);
    
    // 1. Get DOM snapshot to serve as elementsList
    let elementsList = 'No active DOM snapshot available.';
    let mcpBridge = null;
    try {
      mcpBridge = await mcpBridgePool.acquire();
      elementsList = await mcpBridge.navigate(targetUrl);
    } catch (err) {
      console.warn(`[HealingAgent Warning] Could not retrieve live DOM snapshot: ${err.message}`);
    } finally {
      if (mcpBridge) {
        await mcpBridgePool.release(mcpBridge).catch(() => {});
      }
    }

    // 2. Read the failing script
    let originalScript = '';
    try {
      originalScript = await fs.readFile(specPath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read original script: ${err.message}`);
    }

    // 3. Load the healing template dynamically using PromptLoader
    let template;
    try {
      template = await promptLoader.getPrompt('healing', 'heal');
    } catch (err) {
      console.error(`[HealingAgent Error] Failed to load healing skill template:`, err.message);
      throw err;
    }

    const prompt = template
      .replace(/{scriptPath}/g, specPath)
      .replace(/{originalScript}/g, originalScript)
      .replace(/{errorMessage}/g, errorMessage)
      .replace(/{elementsList}/g, elementsList);

    console.log(`[HealingAgent] Requesting healed script from LLM...`);
    const response = await llmClient.ask(prompt);
    
    // 4. Extract code from response
    let healedCode = response.trim();
    if (healedCode.startsWith('```')) {
      const firstNewline = healedCode.indexOf('\n');
      if (firstNewline !== -1) {
        healedCode = healedCode.substring(firstNewline + 1);
      } else {
        healedCode = healedCode.replace(/^```(?:javascript|js)?/, '');
      }
    }
    if (healedCode.endsWith('```')) {
      healedCode = healedCode.substring(0, healedCode.length - 3);
    }
    healedCode = healedCode.trim();

    if (!healedCode.includes('test(')) {
      throw new Error('LLM output does not appear to contain a valid Playwright test block');
    }

    return healedCode;
  }
}

const healingAgent = new HealingAgent();
export default healingAgent;
