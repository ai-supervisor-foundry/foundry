// Log Reader Service
// Reads and parses audit.log.jsonl and prompts.log.jsonl files
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AuditLogEntry {
  timestamp: string;
  iteration: number;
  event: string;
  task_id: string;
  tool_invoked: string;
  state_diff: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  validation_summary: {
    valid: boolean;
    rules_passed: string[];
    rules_failed: string[];
    reason?: string;
  };
  halt_reason?: string;
  prompt_preview?: string;
  response_preview?: string;
  prompt_length?: number;
  response_length?: number;
}

export interface PromptLogEntry {
  timestamp: string;
  task_id: string;
  iteration: number;
  type: 'PROMPT' | 'RESPONSE' | 'INTERROGATION_PROMPT' | 'INTERROGATION_RESPONSE' | 'FIX_PROMPT' | 'CLARIFICATION_PROMPT';
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Read and parse JSONL file
 */
async function readJSONL<T>(filePath: string): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return empty array
      return [];
    }
    throw error;
  }
}

/**
 * Get audit log entries for a project
 */
export async function getAuditLogs(
  projectId: string,
  options: {
    limit?: number;
    taskId?: string;
  } = {}
): Promise<AuditLogEntry[]> {
  const sandboxRoot = resolveSandboxRoot();
  const logPath = path.join(
    sandboxRoot,
    projectId,
    'audit.log.jsonl'
  );

  let entries = await readJSONL<AuditLogEntry>(logPath);

  // Filter by taskId if provided
  if (options.taskId) {
    entries = entries.filter(entry => entry.task_id === options.taskId);
  }

  // Sort by timestamp descending (most recent first)
  entries.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Apply limit
  if (options.limit && options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

/**
 * Get prompt log entries for a project
 */
export async function getPromptLogs(
  projectId: string,
  options: {
    limit?: number;
    taskId?: string;
    type?: PromptLogEntry['type'];
  } = {}
): Promise<PromptLogEntry[]> {
  const sandboxRoot = resolveSandboxRoot();
  const logPath = path.join(
    sandboxRoot,
    projectId,
    'logs',
    'prompts.log.jsonl'
  );

  let entries = await readJSONL<PromptLogEntry>(logPath);

  // Filter by taskId if provided
  if (options.taskId) {
    entries = entries.filter(entry => entry.task_id === options.taskId);
  }

  // Filter by type if provided
  if (options.type) {
    entries = entries.filter(entry => entry.type === options.type);
  }

  // Sort by timestamp descending (most recent first)
  entries.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Apply limit
  if (options.limit && options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

/**
 * Resolve sandbox root path (handle relative paths)
 */
function resolveSandboxRoot(): string {
  const sandboxRoot = config.supervisor.sandboxRoot;
  if (path.isAbsolute(sandboxRoot)) {
    return sandboxRoot;
  }
  // Resolve relative to supervisor project root
  // __dirname is UI/backend/src/services when file is imported
  // Go up 4 levels: services -> src -> backend -> UI -> supervisor
  const supervisorRoot = path.resolve(__dirname, '../../../../');
  const resolved = path.resolve(supervisorRoot, sandboxRoot);
  console.log('[LogReader] Resolved sandbox root:', resolved, 'from config:', sandboxRoot);
  return resolved;
}

/**
 * Get list of available projects (directories in sandbox)
 */
export async function getAvailableProjects(): Promise<string[]> {
  try {
    const sandboxRoot = resolveSandboxRoot();
    console.log('[LogReader] Reading projects from:', sandboxRoot);
    
    // Check if directory exists
    try {
      await fs.access(sandboxRoot);
    } catch {
      console.error('[LogReader] Sandbox directory does not exist:', sandboxRoot);
      return [];
    }
    
    const entries = await fs.readdir(sandboxRoot, { withFileTypes: true });
    console.log('[LogReader] Found entries:', entries.length);
    
    const projects = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !name.startsWith('.')); // Exclude hidden directories

    console.log('[LogReader] Projects found:', projects);
    return projects.sort();
  } catch (error) {
    console.error('[LogReader] Error reading projects:', error);
    if (error instanceof Error) {
      console.error('[LogReader] Error details:', error.message, error.stack);
    }
    return [];
  }
}

