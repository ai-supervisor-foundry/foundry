import {
  serializeQueryParams,
  extractRoutePath,
  extractEntityName,
  generateCacheKey,
  generateCacheBustPattern,
} from './cache-key.util';
import { Request } from 'express';

describe('CacheKeyUtil', () => {
  describe('serializeQueryParams', () => {
    it('should serialize simple query parameters', () => {
      const query = { page: '1', limit: '20' };
      const result = serializeQueryParams(query);

      // URL-encoded, sorted
      expect(decodeURIComponent(result)).toBe('limit=20&page=1');
    });

    it('should remove tenantId from params', () => {
      const query = { tenantId: '1', page: '1', limit: '20' };
      const result = serializeQueryParams(query);

      expect(result).not.toContain('tenantId');
      expect(decodeURIComponent(result)).toBe('limit=20&page=1');
    });

    it('should handle null and undefined values', () => {
      const query = { page: '1', filter: null, sort: undefined };
      const result = serializeQueryParams(query);

      expect(decodeURIComponent(result)).toContain('filter=null');
      expect(decodeURIComponent(result)).toContain('page=1');
    });

    it('should handle object values with JSON.stringify', () => {
      const query = { page: '1', filters: { status: 'active' } };
      const result = serializeQueryParams(query);
      const decoded = decodeURIComponent(result);

      expect(decoded).toContain('filters=');
      expect(decoded).toContain('"status":"active"');
    });

    it('should handle array values', () => {
      const query = { page: '1', ids: [1, 2, 3] };
      const result = serializeQueryParams(query);
      const decoded = decodeURIComponent(result);

      expect(decoded).toContain('ids=');
      expect(decoded).toContain('1');
      expect(decoded).toContain('2');
      expect(decoded).toContain('3');
    });

    it('should sort keys for consistent output', () => {
      const query1 = { page: '1', limit: '20' };
      const query2 = { limit: '20', page: '1' };

      const result1 = serializeQueryParams(query1);
      const result2 = serializeQueryParams(query2);

      expect(result1).toBe(result2);
    });

    it('should URL encode special characters', () => {
      const query = { search: 'test & query', filter: 'value=test' };
      const result = serializeQueryParams(query);

      expect(result).toContain('%26'); // & encoded
      expect(result).toContain('%3D'); // = encoded
    });
  });

  describe('extractRoutePath', () => {
    it('should extract route path without /api prefix', () => {
      const request = {
        path: '/api/v1/customers',
        route: { path: '/api/v1/customers' },
      } as Request;

      const result = extractRoutePath(request);
      expect(result).toBe('v1/customers');
    });

    it('should handle path without /api prefix', () => {
      const request = {
        path: '/v1/customers',
        route: { path: '/v1/customers' },
      } as Request;

      const result = extractRoutePath(request);
      expect(result).toBe('v1/customers');
    });

    it('should use request.path if route.path is not available', () => {
      const request = {
        path: '/api/v1/users',
      } as Request;

      const result = extractRoutePath(request);
      expect(result).toBe('v1/users');
    });

    it('should handle paths with query strings', () => {
      const request = {
        path: '/api/v1/quotes?tenantId=1',
        route: { path: '/api/v1/quotes' },
      } as Request;

      const result = extractRoutePath(request);
      expect(result).toBe('v1/quotes');
    });
  });

  describe('extractEntityName', () => {
    it('should extract entity name from versioned path', () => {
      expect(extractEntityName('v1/customers')).toBe('customers');
      expect(extractEntityName('v1/users')).toBe('users');
      expect(extractEntityName('v1/quotes')).toBe('quotes');
    });

    it('should extract entity name from path without version', () => {
      expect(extractEntityName('customers')).toBe('customers');
      expect(extractEntityName('users')).toBe('users');
    });

    it('should extract first segment from nested paths', () => {
      expect(extractEntityName('v1/customers/123')).toBe('customers');
      expect(extractEntityName('v1/quotes/22/accept')).toBe('quotes');
    });

    it('should handle different version numbers', () => {
      expect(extractEntityName('v2/customers')).toBe('customers');
      expect(extractEntityName('v10/users')).toBe('users');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate cache key with all components', () => {
      const key = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        page: '1',
        limit: '20',
      });

      expect(key).toContain('123');
      expect(key).toContain('5');
      expect(key).toContain('GET');
      expect(key).toContain('v1/customers');
      expect(key).toContain('limit');
      expect(key).toContain('page');
    });

    it('should generate consistent keys for same inputs', () => {
      const key1 = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        page: '1',
        limit: '20',
      });

      const key2 = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        limit: '20',
        page: '1',
      });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different users', () => {
      const key1 = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        page: '1',
      });

      const key2 = generateCacheKey(456, 5, 'GET', 'v1/customers', {
        page: '1',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different tenants', () => {
      const key1 = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        page: '1',
      });

      const key2 = generateCacheKey(123, 6, 'GET', 'v1/customers', {
        page: '1',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different query params', () => {
      const key1 = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        page: '1',
      });

      const key2 = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        page: '2',
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe('generateCacheBustPattern', () => {
    it('should generate pattern for cache busting', () => {
      const pattern = generateCacheBustPattern(123, 5, 'customers');

      expect(pattern).toBe('123-5-GET-v*/customers-*');
    });

    it('should match cache keys for same entity', () => {
      const pattern = generateCacheBustPattern(123, 5, 'customers');
      const cacheKey = generateCacheKey(123, 5, 'GET', 'v1/customers', {
        page: '1',
      });

      // Pattern should match: userId-tenantId-GET-v*/entity-*
      // Cache key: userId-tenantId-GET-routePath-params
      expect(pattern).toBe('123-5-GET-v*/customers-*');

      // Extract the part that should match
      const keyPrefix = cacheKey.split('-').slice(0, 3).join('-');
      const keyEntityPart = cacheKey.split('-').slice(3, 4)[0]; // v1/customers

      expect(keyPrefix).toBe('123-5-GET');
      expect(keyEntityPart).toContain('customers');
    });
  });
});
