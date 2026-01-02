// CLI Adapter - Multi-provider CLI dispatcher with circuit breaker
// Priority-based fallback: GEMINI → COPILOT → CURSOR → CODEX → CLAUDE

import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { CircuitBreakerManager } from '../../../network/resilience/circuitBreaker';
import { Provider } from '../../../../domain/agents/enums/provider';
import { dispatchToCursor } from '../../../connectors/agents/providers/cursorCLI';
import { dispatchToClaude } from '../../../connectors/agents/providers/claudeCLI';
import { dispatchToCodex } from '../../../connectors/agents/providers/codexCLI';
import { dispatchToGemini } from '../../../connectors/agents/providers/geminiCLI';
import { dispatchToGeminiStub } from '../../../connectors/agents/providers/geminiStubCLI';
import { dispatchToCopilot } from '../../../connectors/agents/providers/copilotCLI';
import Redis from 'ioredis';
import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared, log as logShared } from '../../logging/logger';
import { DEFAULT_PRIORITY } from '../../../../config/agents/providers/common';

function log(message: string, ...args: unknown[]): void {
  logShared('CLIAdapter', message, ...args);
}

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`CLIAdapter:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[CLIAdapter] ${operation}`, duration, metadata);
}

export class CLIAdapter {
  private circuitBreaker: CircuitBreakerManager;
  private readonly priority: Provider[];
  private providerInUse: Provider | null = null;

  constructor(
    redisClient: Redis,
    priority?: Provider[],
    ttlSeconds?: number
  ) {
    this.circuitBreaker = new CircuitBreakerManager(redisClient, ttlSeconds);
    this.priority = priority || this.parsePriorityFromEnv() || DEFAULT_PRIORITY;
    log(`CLIAdapter initialized with priority: ${this.priority.join(' → ')}, TTL: ${ttlSeconds || 86400}s`);
  }

  private parsePriorityFromEnv(): Provider[] | null {
    const envPriority = process.env.CLI_PROVIDER_PRIORITY;
    if (!envPriority) {
      return null;
    }

    try {
      const providers = envPriority.split(',').map(p => p.trim().toLowerCase());
      const validProviders: Provider[] = [];
      
      for (const p of providers) {
        if (Object.values(Provider).includes(p as Provider)) {
          validProviders.push(p as Provider);
        } else {
          log(`Warning: Invalid provider in CLI_PROVIDER_PRIORITY: ${p}`);
        }
      }
      
      return validProviders.length > 0 ? validProviders : null;
    } catch (error) {
      log(`Error parsing CLI_PROVIDER_PRIORITY: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Select first available provider (not circuit-broken)
   * Returns null if all providers are circuit-broken
   */
  private async selectProvider(): Promise<Provider | null> {
    const startTime = Date.now();
    logVerbose('SelectProvider', 'Selecting provider from priority list', {
      priority: this.priority,
    });

    for (const provider of this.priority) {
      const isOpen = await this.circuitBreaker.isOpen(provider);
      if (!isOpen) {
        const duration = Date.now() - startTime;
        logPerformance('ProviderSelection', duration, { selected_provider: provider });
        log(`Selected provider: ${provider} (priority ${this.priority.indexOf(provider) + 1})`);
        logVerbose('SelectProvider', 'Provider selected', {
          provider,
          priority_index: this.priority.indexOf(provider),
        });
        this.providerInUse = provider;
        return provider;
      } else {
        logVerbose('SelectProvider', 'Provider is circuit-broken, trying next', {
          provider,
          priority_index: this.priority.indexOf(provider),
        });
      }
    }

    const duration = Date.now() - startTime;
    logPerformance('ProviderSelection', duration, { selected_provider: null, all_circuit_broken: true });
    log('All providers are circuit-broken');
    logVerbose('SelectProvider', 'All providers are circuit-broken', {
      priority: this.priority,
    });
    return null;
  }

  /**
   * Check if result should trigger circuit breaker
   */
  private shouldTriggerCircuitBreaker(provider: Provider, result: ProviderResult): boolean {
    const errorText = (result.stderr + result.stdout).toLowerCase();
    
    switch (provider) {
      case Provider.CURSOR:
        return (
          errorText.includes('connecterror') &&
          errorText.includes('resource_exhausted')
        );
      case Provider.CLAUDE:
        // @todo: Implement Claude-specific error detection
        return errorText.includes('rate limit') || errorText.includes('quota exceeded');
      case Provider.CODEX:
        // @todo: Implement Codex-specific error detection
        return errorText.includes('api error') || errorText.includes('rate limit');
      case Provider.GEMINI:
        // Gemini CLI error detection
        return (
          errorText.includes('quota') ||
          errorText.includes('rate limit') ||
          errorText.includes('resource exhausted') ||
          errorText.includes('api key') ||
          errorText.includes('authentication')
        );
      case Provider.GEMINI_STUB:
        return (
          errorText.includes('quota') ||
          errorText.includes('rate limit') ||
          errorText.includes('resource exhausted') ||
          errorText.includes('api key') ||
          errorText.includes('authentication')
        );
      case Provider.COPILOT:
        return (
          errorText.includes('rate limit') ||
          errorText.includes('quota exceeded') ||
          errorText.includes('unauthorized') ||
          errorText.includes('expired token')
        );
      default:
        return false;
    }
  }

  /**
   * Execute a specific provider
   */
  private async executeProvider(
    provider: Provider,
    prompt: string,
    cwd: string,
    agentMode?: string,
    sessionId?: string,
    featureId?: string
  ): Promise<ProviderResult> {
    log(`Executing provider: ${provider}`);
    logVerbose('ExecuteProvider', 'Executing provider', {
      provider,
      prompt_length: prompt.length,
      cwd,
      agent_mode: agentMode,
      session_id: sessionId,
      feature_id: featureId,
    });

    switch (provider) {
      case Provider.CURSOR:
        return await dispatchToCursor(prompt, cwd, agentMode, sessionId, featureId);
      case Provider.CLAUDE:
        return await dispatchToClaude(prompt, cwd, agentMode);
      case Provider.CODEX:
        return await dispatchToCodex(prompt, cwd, agentMode);
      case Provider.GEMINI:
        return await dispatchToGemini(prompt, cwd, agentMode, sessionId, featureId);
      case Provider.COPILOT:
        return await dispatchToCopilot(prompt, cwd, agentMode, sessionId, featureId);
      case Provider.GEMINI_STUB:
        return await dispatchToGeminiStub(prompt, cwd, agentMode, sessionId, featureId);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Main entry point - same interface as CLIAdapter
   */
  async execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string,
    sessionId?: string,
    featureId?: string
  ): Promise<ProviderResult> {
    const startTime = Date.now();
    log(`Executing CLI adapter for prompt (${prompt.length} chars) in directory: ${workingDirectory}${sessionId ? ` (Session: ${sessionId})` : ''}`);
    logVerbose('Execute', 'CLI adapter execution started', {
      prompt_length: prompt.length,
      working_directory: workingDirectory,
      agent_mode: agentMode,
      session_id: sessionId,
      feature_id: featureId,
    });

    // Select first available provider
    let selectedProvider = await this.selectProvider();
    logVerbose('Execute', 'Selected provider', {
      provider: selectedProvider,
    });
    
    if (selectedProvider === null) {
      const error = 'All CLI providers are circuit-broken';
      log(error);
      logVerbose('Execute', 'All providers circuit-broken', {
        priority: this.priority,
      });
      
      // Return error result
      return {
        stdout: '',
        stderr: error,
        exitCode: 1,
        rawOutput: error,
        status: 'FAILED',
        output: error,
      };
    }

    // Try each provider in priority order until one succeeds
    let lastError: Error | null = null;
    logVerbose('Execute', 'Last error', {
      last_error: lastError,
    });
    
    for (let i = this.priority.indexOf(selectedProvider); i < this.priority.length; i++) {
      const provider = this.priority[i];
      logVerbose('Execute', 'Provider', {
        provider,
        priority_index: i,
      });
      
      // Check if this provider is available
      const isOpen = await this.circuitBreaker.isOpen(provider);
      if (isOpen) {
        log(`Provider ${provider} is circuit-broken (circuit open), trying next provider`);
        logVerbose('Execute', 'Provider circuit-broken, trying next', {
          provider,
          priority_index: i,
        });
        continue;
      }

      try {
        log(`Attempting provider: ${provider}`);
        logVerbose('Execute', 'Attempting provider execution', {
          provider,
          priority_index: i,
        });

        const result = await this.executeProvider(provider, prompt, workingDirectory, agentMode, sessionId, featureId);
        const duration = Date.now() - startTime;
        logPerformance('CLIAdapterExecution', duration, {
          provider,
          success: true,
          exit_code: result.exitCode,
        });

        // Check if result should trigger circuit breaker
        if (this.shouldTriggerCircuitBreaker(provider, result)) {
          const errorType = this.extractErrorType(provider, result);
          log(`Circuit breaker triggered for ${provider}: ${errorType}`);
          logVerbose('Execute', 'Circuit breaker triggered', {
            provider,
            error_type: errorType,
          });
          await this.circuitBreaker.close(provider, errorType);
          
          // If this was the last provider, return the result anyway
          if (i === this.priority.length - 1) {
            log(`Last provider ${provider} circuit-broken, returning result`);
            return result;
          }
          
          // Otherwise, try next provider
          log(`Provider ${provider} circuit-broken, falling back to next provider`);
          continue;
        }

        // Success - return result
        log(`Provider ${provider} executed successfully`);
        logVerbose('Execute', 'Provider execution successful', {
          provider,
          exit_code: result.exitCode,
        });
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log(`Provider ${provider} failed: ${lastError.message}`);
        logVerbose('Execute', 'Provider execution failed', {
          provider,
          error: lastError.message,
        });

        // Check if error should trigger circuit breaker
        const errorText = lastError.message.toLowerCase();
        if (
          (errorText.includes('resource_exhausted') || errorText.includes('exhausted')) ||
          errorText.includes('rate limit') ||
          errorText.includes('quota')
        ) {
          await this.circuitBreaker.close(provider, lastError.message);
        }

        // Try next provider
        if (i < this.priority.length - 1) {
          log(`Falling back to next provider`);
          continue;
        }
      }
    }

    // All providers failed
    const duration = Date.now() - startTime;
    logPerformance('CLIAdapterExecution', duration, {
      success: false,
      all_providers_failed: true,
    });
    
    const errorMessage = lastError
      ? `All providers failed. Last error: ${lastError.message}`
      : 'All providers failed';
    
    log(errorMessage);
    logVerbose('Execute', 'All providers failed', {
      priority: this.priority,
      last_error: lastError?.message,
    });

    return {
      stdout: '',
      stderr: errorMessage,
      exitCode: 1,
      rawOutput: errorMessage,
      status: 'FAILED',
      output: errorMessage,
    };
  }

  getProviderInUse(): Provider | null {
    return this.providerInUse;
  }

  /**
   * Extract error type from result for circuit breaker
   */
  private extractErrorType(provider: Provider, result: ProviderResult): string {
    const errorText = (result.stderr + result.stdout).toLowerCase();
    
    if (errorText.includes('resource_exhausted')) {
      return 'resource_exhausted';
    }
    if (errorText.includes('rate limit')) {
      return 'rate_limit';
    }
    if (errorText.includes('quota')) {
      return 'quota_exceeded';
    }
    if (errorText.includes('api error')) {
      return 'api_error';
    }
    
    return 'unknown_error';
  }
}

