// Port: LLM Provider
// Interface for interacting with LLM providers (CLI, API, etc.)

import { ProviderResult } from '../executors/haltDetection';
import { Provider } from '../agents/enums/provider';

export interface LLMProviderPort {
  /**
   * Execute a prompt against the configured provider
   */
  execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string,
    sessionId?: string,
    featureId?: string,
    providerOverride?: Provider
  ): Promise<ProviderResult>;

  /**
   * Get the provider currently in use (if any)
   */
  getProviderInUse(): Provider | null;
}
