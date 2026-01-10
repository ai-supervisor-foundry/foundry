import { Ollama } from 'ollama';
import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { logVerbose } from '../../../adapters/logging/logger';
import { helperAgentConfig } from '../../../../config/modelConfig';

export class OllamaProvider {
  private client: Ollama;
  private modelName: string;

  constructor(baseUrl: string, modelName: string) {
    this.client = new Ollama({ host: baseUrl });
    this.modelName = modelName;
  }

  async execute(prompt: string): Promise<ProviderResult> {
    const startTime = Date.now();
    logVerbose('OllamaProvider', 'Executing prompt', { model: this.modelName });

    try {
        const response = await this.client.chat({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          format: 'json',
          options: { temperature: 0.1 },
        });

        const durationSeconds = (Date.now() - startTime) / 1000;
        
        logVerbose('OllamaProvider', 'Execution completed', { 
            durationSeconds, 
            tokens: response.eval_count 
        });

        return {
          stdout: response.message.content,
          stderr: '',
          exitCode: 0,
          rawOutput: response.message.content,
          status: 'COMPLETED',
          usage: {
            tokens: response.eval_count,
            durationSeconds: durationSeconds
          }
        };
    } catch (error) {
        logVerbose('OllamaProvider', 'Execution failed', { error: String(error) });
        return {
          stdout: '',
          stderr: String(error),
          exitCode: 1,
          rawOutput: '',
          status: 'FAILED',
          output: String(error)
        };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let ollamaInstance: OllamaProvider | null = null;

export async function dispatchToOllama(prompt: string, cwd: string, agentMode?: string, sessionId?: string, featureId?: string): Promise<ProviderResult> {
    if (!ollamaInstance) {
        ollamaInstance = new OllamaProvider(helperAgentConfig.ollamaBaseUrl, helperAgentConfig.localModelName);
    }
    return await ollamaInstance.execute(prompt);
}