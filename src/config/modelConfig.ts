// Configuration for Helper Agent models (Local/Cloud)

export interface HelperAgentConfig {
  useLocalModel: boolean;
  localModelName: string;
  ollamaBaseUrl: string;
  fallbackToCloud: boolean;
  maxRetries: number;
}

export const helperAgentConfig: HelperAgentConfig = {
  useLocalModel: process.env.USE_LOCAL_HELPER_AGENT === 'true',
  localModelName: process.env.LOCAL_HELPER_MODEL || 'phi4-mini',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  fallbackToCloud: true,
  maxRetries: 2,
};
