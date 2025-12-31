// CLI Adapter - Multi-provider CLI dispatcher with circuit breaker
// Priority-based fallback: Cursor → Gemini → Codex → Claude

import { CursorResult } from './haltDetection';
import { CircuitBreakerManager, Provider } from './circuitBreaker';
import { dispatchToCursor } from './providers/cursorCLI';
import { dispatchToClaude } from './providers/claudeCLI';
import { dispatchToCodex } from './providers/codexCLI';
import { dispatchToGemini } from './providers/geminiCLI';
import Redis from 'ioredis';
import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared, log as logShared } from './logger';

function log(message: string, ...args: unknown[]): void {
  const fullMessage = `[CLIAdapter] ${message}`;
  if (args.length > 0) {
    console.log(fullMessage, ...args);
  } else {
    console.log(fullMessage);
  }
}

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`CLIAdapter:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[CLIAdapter] ${operation}`, duration, metadata);
}

// Default priority order: Gemini → Cursor → Codex → Claude
// Gemini first for better performance, Claude moved to end due to payment requirements
const DEFAULT_PRIORITY: Provider[] = [
  Provider.GEMINI,
  Provider.CURSOR,
  Provider.CODEX,
  Provider.CLAUDE,
];

export class CLIAdapter {
  private circuitBreaker: CircuitBreakerManager;
  private priority: Provider[];

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
      if (isOpen) {
        const duration = Date.now() - startTime;
        logPerformance('ProviderSelection', duration, { selected_provider: provider });
        log(`Selected provider: ${provider} (priority ${this.priority.indexOf(provider) + 1})`);
        logVerbose('SelectProvider', 'Provider selected', {
          provider,
          priority_index: this.priority.indexOf(provider),
        });
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
  private shouldTriggerCircuitBreaker(provider: Provider, result: CursorResult): boolean {
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
    agentMode?: string
  ): Promise<CursorResult> {
    log(`Executing provider: ${provider}`);
    logVerbose('ExecuteProvider', 'Executing provider', {
      provider,
      prompt_length: prompt.length,
      cwd,
      agent_mode: agentMode,
    });

    switch (provider) {
      case Provider.CURSOR:
        return await dispatchToCursor(prompt, cwd, agentMode);
      case Provider.CLAUDE:
        return await dispatchToClaude(prompt, cwd, agentMode);
      case Provider.CODEX:
        return await dispatchToCodex(prompt, cwd, agentMode);
      case Provider.GEMINI:
        return await dispatchToGemini(prompt, cwd, agentMode);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Main entry point - same interface as CursorCLI
   */
  async execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string
  ): Promise<CursorResult> {
    const startTime = Date.now();
    log(`Executing CLI adapter for prompt (${prompt.length} chars) in directory: ${workingDirectory}`);
    logVerbose('Execute', 'CLI adapter execution started', {
      prompt_length: prompt.length,
      working_directory: workingDirectory,
      agent_mode: agentMode,
    });

    // Select first available provider
    let selectedProvider = await this.selectProvider();
    
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
    
    for (let i = this.priority.indexOf(selectedProvider); i < this.priority.length; i++) {
      const provider = this.priority[i];
      
      // Check if this provider is available
      const isOpen = await this.circuitBreaker.isOpen(provider);
      if (!isOpen) {
        log(`Provider ${provider} is circuit-broken, trying next provider`);
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

        const result = await this.executeProvider(provider, prompt, workingDirectory, agentMode);
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
          (provider === Provider.CURSOR && errorText.includes('resource_exhausted')) ||
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

  /**
   * Extract error type from result for circuit breaker
   */
  private extractErrorType(provider: Provider, result: CursorResult): string {
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

