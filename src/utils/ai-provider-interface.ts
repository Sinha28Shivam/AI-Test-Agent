/**
 * Abstract interface for AI providers
 * Allows swapping between Copilot, Claude, OpenAI, Gemini, etc.
 */

export interface AIResponse {
  success: boolean;
  data?: string;
  error?: string;
  message?: string;
  provider: string;
  duration: number;
}

export interface AIProviderConfig {
  name: string;
  enabled: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  name: string;
  config: AIProviderConfig;
  
  /**
   * Generate code based on prompt
   */
  generate(prompt: string): Promise<AIResponse>;
  
  /**
   * Analyze text/data and return insights
   */
  analyze(prompt: string): Promise<AIResponse>;
  
  /**
   * Check if provider is available/installed
   */
  isAvailable(): Promise<boolean>;
}
