import { Request } from 'express';

export interface CacheKeyComponents {
  userId: number;
  tenantId: number;
  method: string;
  routePath: string;
  paramsSerialized: string;
}

/**
 * Serialize query parameters for cache key
 * Sorts parameters for consistent key generation
 * URL-encodes the result to handle special characters safely
 */
export function serializeQueryParams(query: Record<string, any>): string {
  // Remove tenantId as it's part of the key, not params
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenantId, ...params } = query;

  // Sort keys and create consistent string representation
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => {
      const value = params[key];
      // Handle different value types
      if (value === null || value === undefined) {
        return `${key}=null`;
      }
      // For arrays and objects, use JSON.stringify for consistency
      if (typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    })
    .join('&');

  // URL encode to handle special characters safely
  // This ensures cache keys are safe for Redis/Dragonfly
  return encodeURIComponent(paramString);
}

/**
 * Extract route path from request
 * Removes /api prefix and version prefix
 * Example: /api/v1/customers -> v1/customers
 */
export function extractRoutePath(request: Request): string {
  const path = request.route?.path || request.path;
  // Remove /api prefix if present
  const withoutApi = path.replace(/^\/api/, '');
  // Remove leading slash
  return withoutApi.startsWith('/') ? withoutApi.substring(1) : withoutApi;
}

/**
 * Extract entity name from route path
 * Example: v1/customers -> customers
 * Example: v1/users -> users
 */
export function extractEntityName(routePath: string): string {
  // Remove version prefix (v1/, v2/, etc.)
  const withoutVersion = routePath.replace(/^v\d+\//, '');
  // Get first segment (entity name)
  return withoutVersion.split('/')[0];
}

/**
 * Generate cache key for GET requests
 */
export function generateCacheKey(
  userId: number,
  tenantId: number,
  method: string,
  routePath: string,
  query: Record<string, any>,
): string {
  const paramsSerialized = serializeQueryParams(query);
  return `${userId}-${tenantId}-${method}-${routePath}-${paramsSerialized}`;
}

/**
 * Generate cache key pattern for cache busting
 * Matches all cache keys for a specific entity, user, and tenant
 */
export function generateCacheBustPattern(
  userId: number,
  tenantId: number,
  entityName: string,
): string {
  // Pattern: {userId}-{tenantId}-GET-v*/{entityName}-*
  return `${userId}-${tenantId}-GET-v*/${entityName}-*`;
}
