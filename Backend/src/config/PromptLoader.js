import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptLoader {
  constructor() {
    this.promptCache = new Map();
  }

  async load() {
    // Deprecated: No longer loading a single monolithic prompts file
    return {};
  }

  async getPrompt(category, key) {
    const cacheKey = `${category}-${key}`;
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey);
    }

    const skillFilePath = path.join(__dirname, '..', 'skills', `${category}-${key}.md`);
    try {
      const content = await fs.readFile(skillFilePath, 'utf-8');
      const normalizedContent = content.trim();
      this.promptCache.set(cacheKey, normalizedContent);
      return normalizedContent;
    } catch (err) {
      console.error(`[PromptLoader Error] Failed to load skill prompt for ${category}:${key}:`, err.message);
      throw new Error(`Prompt key '${key}' not found in prompts category '${category}' (checked: ${skillFilePath})`);
    }
  }
}

const promptLoader = new PromptLoader();
export default promptLoader;
