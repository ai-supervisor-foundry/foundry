/**
 * Lightweight in-memory file discovery cache.
 * Populated by the validator during code file scanning;
 * consumed by the interrogator to skip duplicate I/O.
 * Keyed by sandboxCwd (absolute path).
 */

import { logVerbose } from '../../infrastructure/adapters/logging/logger';

interface CacheEntry {
  files: string[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_AGE_MS = 60_000; // 1 minute — covers a single validation+interrogation cycle

export function setDiscoveredFiles(sandboxCwd: string, files: string[]): void {
  cache.set(sandboxCwd, { files, timestamp: Date.now() });
  logVerbose('FileDiscoveryCache', 'Cached file list', { sandboxCwd, fileCount: files.length });
}

export function getDiscoveredFiles(sandboxCwd: string): string[] | null {
  const entry = cache.get(sandboxCwd);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MAX_AGE_MS) {
    cache.delete(sandboxCwd);
    return null;
  }
  logVerbose('FileDiscoveryCache', 'Cache hit', { sandboxCwd, fileCount: entry.files.length });
  return entry.files;
}

export function clearFileDiscoveryCache(sandboxCwd?: string): void {
  if (sandboxCwd) {
    cache.delete(sandboxCwd);
  } else {
    cache.clear();
  }
}
