import { LLMProviderPort } from '@/domain/ports/llmProvider';
import { ProviderResult } from '@/domain/executors/haltDetection';
import { Provider } from '@/domain/agents/enums/provider';

import { fsRegistry } from '../../../helpers/fs-registry';
import * as path from 'path';

export abstract class BaseProviderMock implements LLMProviderPort {
  protected responses: { result: ProviderResult; files?: Record<string, string> }[] = [];
  protected callHistory: {
    prompt: string;
    workingDirectory: string;
    agentMode?: string;
    sessionId?: string;
    featureId?: string;
  }[] = [];

  constructor(public readonly provider: Provider) {}

  async execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string,
    sessionId?: string,
    featureId?: string
  ): Promise<ProviderResult> {
    this.callHistory.push({
      prompt,
      workingDirectory,
      agentMode,
      sessionId,
      featureId,
    });

    const response = this.responses.shift();
    if (!response) {
      throw new Error(`No mock response configured for provider ${this.provider}. Call history length: ${this.callHistory.length}`);
    }

    // Simulate file changes
    if (response.files && fsRegistry.currentMock) {
      for (const [filePath, content] of Object.entries(response.files)) {
        // Resolve path relative to working directory
        const absolutePath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(workingDirectory, filePath);
        await fsRegistry.currentMock.writeFile(absolutePath, content);
      }
    }

    return response.result;
  }

  getProviderInUse(): Provider | null {
    return this.provider;
  }

  // --- Mock Configuration Methods ---
  pushResponse(response: ProviderResult, files?: Record<string, string>): void {
    this.responses.push({ result: response, files });
  }

  pushSuccessResponse(jsonOutput: any, files?: Record<string, string>): void {
    const rawOutput = JSON.stringify(jsonOutput);
    this.pushResponse({
      stdout: rawOutput,
      stderr: '',
      exitCode: 0,
      rawOutput: rawOutput,
    }, files);
  }

  pushErrorResponse(message: string, exitCode: number = 1): void {
    this.pushResponse({
      stdout: '',
      stderr: message,
      exitCode: exitCode,
      rawOutput: message,
    });
  }

  getCallHistory() {
    return [...this.callHistory];
  }

  reset(): void {
    this.responses = [];
    this.callHistory = [];
  }
}
