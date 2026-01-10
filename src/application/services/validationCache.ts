import Redis from 'ioredis';
import * as crypto from 'crypto';
import { hashFiles } from './fileHasher';
import { logVerbose } from '../../infrastructure/adapters/logging/logger';

export interface CachedCriterionResult {
  satisfied: boolean;
  matchQuality: 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  evidence?: string;
}

export class ValidationCacheManager {
  private redis: Redis | null = null;
  private readonly DEFAULT_TTL_SECONDS = 3600; // 1 hour as per plan

  /**
   * Initialize the cache manager with a Redis client
   */
  initialize(redis: Redis): void {
    this.redis = redis;
  }

  private hashString(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  private async buildCacheKey(projectId: string, criterion: string, codeFiles: string[]): Promise<string> {
    const fileHash = await hashFiles(codeFiles);
    const criterionHash = this.hashString(criterion);
    // Format: validation_cache:<project_id>:<criterion_hash>:<file_hash>
    return `validation_cache:${projectId}:${criterionHash}:${fileHash}`;
  }

  /**
   * Try to retrieve a cached validation result from Redis
   */
  async getCachedResult(
    projectId: string,
    criterion: string,
    codeFiles: string[]
  ): Promise<CachedCriterionResult | null> {
    if (!this.redis || codeFiles.length === 0) return null;

    try {
      const cacheKey = await this.buildCacheKey(projectId, criterion, codeFiles);
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      logVerbose('ValidationCache', 'Cache hit', { criterion, projectId });
      return JSON.parse(cached);
    } catch (error) {
      logVerbose('ValidationCache', 'Cache read error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Cache a validation result in Redis
   */
  async setCachedResult(
    projectId: string,
    criterion: string,
    codeFiles: string[],
    result: CachedCriterionResult,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS
  ): Promise<void> {
    if (!this.redis || codeFiles.length === 0) return;

    try {
      const cacheKey = await this.buildCacheKey(projectId, criterion, codeFiles);
      await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(result));
      
      logVerbose('ValidationCache', 'Result cached in Redis', { 
        criterion, 
        projectId, 
        ttlSeconds 
      });
    } catch (error) {
      logVerbose('ValidationCache', 'Cache write error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

export const validationCache = new ValidationCacheManager();
