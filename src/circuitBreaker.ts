// Circuit Breaker Management
// TTL-based circuit breakers stored in DragonflyDB

import Redis from 'ioredis';
import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared } from './logger';

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`CircuitBreaker:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[CircuitBreaker] ${operation}`, duration, metadata);
}

export enum Provider {
  CURSOR = 'cursor',
  CLAUDE = 'claude',
  CODEX = 'codex',
  GEMINI = 'gemini',
}

export interface CircuitBreakerStatus {
  provider: Provider;
  triggered_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp
  error_type: string;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 1 day

export class CircuitBreakerManager {
  constructor(
    private redisClient: Redis,
    private ttlSeconds: number = DEFAULT_TTL_SECONDS
  ) {}

  private getKey(provider: Provider): string {
    return `circuit_breaker:${provider}`;
  }

  /**
   * Check if circuit breaker is open (provider is available)
   * Returns true if breaker is open (can use provider), false if closed (circuit-broken)
   */
  async isOpen(provider: Provider): Promise<boolean> {
    const startTime = Date.now();
    const key = this.getKey(provider);
    
    logVerbose('IsOpen', 'Checking circuit breaker status', { provider, key });
    
    try {
      const value = await this.redisClient.get(key);
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerCheck', duration, { provider, found: value !== null });
      
      if (value === null) {
        // No circuit breaker set, provider is available
        logVerbose('IsOpen', 'Circuit breaker not set, provider is open', { provider });
        return true;
      }
      
      // Circuit breaker exists, check if expired
      const status: CircuitBreakerStatus = JSON.parse(value);
      const now = Date.now();
      const expiresAt = new Date(status.expires_at).getTime();
      
      if (now >= expiresAt) {
        // Circuit breaker expired, provider is available again
        logVerbose('IsOpen', 'Circuit breaker expired, provider is open', {
          provider,
          expired_at: status.expires_at,
        });
        // Clean up expired breaker
        await this.redisClient.del(key);
        return true;
      }
      
      // Circuit breaker is active, provider is closed
      logVerbose('IsOpen', 'Circuit breaker is active, provider is closed', {
        provider,
        triggered_at: status.triggered_at,
        expires_at: status.expires_at,
        error_type: status.error_type,
      });
      return false;
    } catch (error) {
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerCheck', duration, { provider, error: true });
      logVerbose('IsOpen', 'Error checking circuit breaker, defaulting to open', {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      // On error, default to open (allow provider usage)
      return true;
    }
  }

  /**
   * Check if circuit breaker is closed (provider is circuit-broken)
   */
  async isClosed(provider: Provider): Promise<boolean> {
    return !(await this.isOpen(provider));
  }

  /**
   * Close circuit breaker (trigger it) for a provider
   * Sets TTL to 1 day (or configured TTL)
   */
  async close(provider: Provider, error: string): Promise<void> {
    const startTime = Date.now();
    const key = this.getKey(provider);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    
    const status: CircuitBreakerStatus = {
      provider,
      triggered_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      error_type: error,
    };
    
    logVerbose('Close', 'Closing circuit breaker', {
      provider,
      error_type: error,
      expires_at: expiresAt.toISOString(),
      ttl_seconds: this.ttlSeconds,
    });
    
    try {
      // Use SETEX to set with TTL atomically
      await this.redisClient.setex(key, this.ttlSeconds, JSON.stringify(status));
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerClose', duration, { provider, ttl_seconds: this.ttlSeconds });
      logVerbose('Close', 'Circuit breaker closed successfully', {
        provider,
        key,
        expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerClose', duration, { provider, error: true });
      logVerbose('Close', 'Error closing circuit breaker', {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Open circuit breaker (reset it) for a provider
   * Manually opens the breaker, useful for testing or manual recovery
   */
  async open(provider: Provider): Promise<void> {
    const startTime = Date.now();
    const key = this.getKey(provider);
    
    logVerbose('Open', 'Opening circuit breaker', { provider, key });
    
    try {
      await this.redisClient.del(key);
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerOpen', duration, { provider });
      logVerbose('Open', 'Circuit breaker opened successfully', { provider });
    } catch (error) {
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerOpen', duration, { provider, error: true });
      logVerbose('Open', 'Error opening circuit breaker', {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get circuit breaker status for a provider
   * Returns null if breaker is open (not set or expired)
   */
  async getStatus(provider: Provider): Promise<CircuitBreakerStatus | null> {
    const startTime = Date.now();
    const key = this.getKey(provider);
    
    logVerbose('GetStatus', 'Getting circuit breaker status', { provider, key });
    
    try {
      const value = await this.redisClient.get(key);
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerGetStatus', duration, { provider, found: value !== null });
      
      if (value === null) {
        return null;
      }
      
      const status: CircuitBreakerStatus = JSON.parse(value);
      
      // Check if expired
      const now = Date.now();
      const expiresAt = new Date(status.expires_at).getTime();
      if (now >= expiresAt) {
        // Expired, clean up and return null
        await this.redisClient.del(key);
        return null;
      }
      
      return status;
    } catch (error) {
      const duration = Date.now() - startTime;
      logPerformance('CircuitBreakerGetStatus', duration, { provider, error: true });
      logVerbose('GetStatus', 'Error getting circuit breaker status', {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

