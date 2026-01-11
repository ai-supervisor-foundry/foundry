import { LLMProviderPort } from '@/domain/ports/llmProvider';
import { ProviderResult } from '@/domain/executors/haltDetection';
import { Provider } from '@/domain/agents/enums/provider';

export class CLIAdapterMock implements LLMProviderPort {
  private providers: Map<Provider, LLMProviderPort> = new Map();
  private providerInUse: Provider | null = null;
  private callHistory: any[] = [];

  registerProvider(provider: Provider, mock: LLMProviderPort): void {
    this.providers.set(provider, mock);
  }

  async execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string,
    sessionId?: string,
    featureId?: string,
    providerOverride?: Provider
  ): Promise<ProviderResult> {
    this.callHistory.push({
      prompt,
      workingDirectory,
      agentMode,
      sessionId,
      featureId,
      providerOverride,
    });

    const providerToUse = providerOverride || Provider.GEMINI; // Default to Gemini for tests
    const provider = this.providers.get(providerToUse);

    if (!provider) {
      throw new Error(`Provider ${providerToUse} not registered in CLIAdapterMock`);
    }

    this.providerInUse = providerToUse;
    return await provider.execute(prompt, workingDirectory, agentMode, sessionId, featureId);
  }

  getProviderInUse(): Provider | null {
    return this.providerInUse;
  }

  reset(): void {
    this.providerInUse = null;
    this.callHistory = [];
    for (const provider of this.providers.values()) {
      if ((provider as any).reset) (provider as any).reset();
    }
  }

  getCallHistory() {
    return [...this.callHistory];
  }
}
