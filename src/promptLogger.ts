// Prompt Logger - Full prompt and response logging
// Separate from audit logs for detailed debugging
// JSONL format, one entry per line
// No mutation, no deletion

import * as fs from 'fs/promises';
import * as path from 'path';
import { log as logShared } from './logger';

function logMessage(message: string, ...args: unknown[]): void {
  logShared('PromptLogger', message, ...args);
}

export type PromptLogType =
  | 'PROMPT'
  | 'RESPONSE'
  | 'INTERROGATION_PROMPT'
  | 'INTERROGATION_RESPONSE'
  | 'FIX_PROMPT'
  | 'CLARIFICATION_PROMPT'
  | 'HELPER_AGENT_PROMPT'
  | 'HELPER_AGENT_RESPONSE';

export interface PromptLogEntry {
  timestamp: string; // ISO format
  task_id: string;
  iteration: number;
  type: PromptLogType;
  content: string; // Full prompt/response content (may be truncated if >100KB)
  metadata: {
    agent_mode?: string;
    working_directory?: string;
    prompt_length?: number;
    response_length?: number;
    stdout_length?: number;
    stderr_length?: number;
    exit_code?: number;
    duration_ms?: number;
    intent?: string;
    truncated?: boolean;
    original_length?: number;
    criterion?: string; // For interrogation entries (single criterion)
    criteria?: string[]; // For batched interrogation entries (multiple criteria)
    criteria_count?: number; // For batched interrogation entries
    question_number?: number; // For interrogation entries
    analysis_result?: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; // For interrogation responses
    analysis_results?: { [criterion: string]: { result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; reason: string; file_paths?: string[] } }; // For batched interrogation responses
    file_paths_found?: string[]; // For interrogation responses - file paths mentioned by agent
    direct_file_verification?: boolean; // For interrogation responses - whether files were verified directly
    prompt_type?: string; // For fix/clarification prompts: "fix", "clarification", "fix_fallback", "helper_agent_command_generation"
    retry_count?: number; // For fix/clarification prompts
    // Helper Agent command generation metadata
    failed_criteria?: string[]; // For Helper Agent prompts - failed criteria being checked
    failed_criteria_count?: number; // For Helper Agent prompts - count of failed criteria
    helper_agent_is_valid?: boolean; // For Helper Agent responses
    helper_agent_commands_count?: number; // For Helper Agent responses
    helper_agent_commands?: string[]; // For Helper Agent responses
    command_execution_passed?: boolean; // For command execution results
    command_execution_results?: Array<{ command: string; exitCode: number; passed: boolean }>; // For command execution results
  };
}

const MAX_CONTENT_SIZE = 100 * 1024; // 100KB

/**
 * Truncate content if it exceeds MAX_CONTENT_SIZE
 * Appends truncation note if truncated
 */
function truncateContent(content: string): { content: string; truncated: boolean; originalLength: number } {
  if (content.length <= MAX_CONTENT_SIZE) {
    return { content, truncated: false, originalLength: content.length };
  }

  const truncated = content.substring(0, MAX_CONTENT_SIZE);
  const note = `\n\n[TRUNCATED: ${content.length} bytes total]`;
  return {
    content: truncated + note,
    truncated: true,
    originalLength: content.length,
  };
}

/**
 * Append prompt log entry
 * Creates logs directory if needed
 * Handles truncation for large content
 */
export async function appendPromptLog(
  entry: Omit<PromptLogEntry, 'timestamp'>,
  sandboxRoot: string,
  projectId: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  const fullEntry: PromptLogEntry = {
    ...entry,
    timestamp,
  };

  // Determine log file path
  const logDir = path.join(sandboxRoot, projectId, 'logs');
  const logPath = path.join(logDir, 'prompts.log.jsonl');
  logMessage(`Appending prompt log for task ${entry.task_id} to: ${logPath}`);

  // Truncate content if needed
  const { content: truncatedContent, truncated, originalLength } = truncateContent(fullEntry.content);
  fullEntry.content = truncatedContent;
  if (truncated) {
    fullEntry.metadata.truncated = true;
    fullEntry.metadata.original_length = originalLength;
  }

  // Create directory if it doesn't exist
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    logMessage(`ERROR: Failed to create log directory: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw - continue execution even if logging fails
    return;
  }

  // Serialize to JSON line (JSONL format)
  const logLine = JSON.stringify(fullEntry) + '\n';

  // Append to file (append-only, no mutation, no deletion)
  try {
    await fs.appendFile(logPath, logLine, 'utf8');
    logMessage(`Prompt log entry written for task ${entry.task_id}, type: ${entry.type}`);
  } catch (error) {
    logMessage(`ERROR: Failed to append prompt log: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw - continue execution even if logging fails
  }
}

// Legacy PromptLogger class for backward compatibility
export class PromptLogger {
  constructor(
    private logPath: string // Path to append-only log file
  ) {}

  async append(entry: Omit<PromptLogEntry, 'timestamp'>): Promise<void> {
    logMessage(`Appending legacy prompt log entry: ${entry.type}`);
    
    const timestamp = new Date().toISOString();
    const fullEntry: PromptLogEntry = {
      ...entry,
      timestamp,
    };

    // Truncate content if needed
    const { content: truncatedContent, truncated, originalLength } = truncateContent(fullEntry.content);
    fullEntry.content = truncatedContent;
    if (truncated) {
      fullEntry.metadata.truncated = true;
      fullEntry.metadata.original_length = originalLength;
    }

    // Serialize to JSON line (JSONL format)
    const logLine = JSON.stringify(fullEntry) + '\n';
    
    try {
      // Ensure directory exists
      const logDir = path.dirname(this.logPath);
      await fs.mkdir(logDir, { recursive: true });
      
      // Append to file
      await fs.appendFile(this.logPath, logLine, 'utf8');
      logMessage(`Legacy prompt log entry written: ${entry.type}`);
    } catch (error) {
      logMessage(`ERROR: Failed to append legacy prompt log: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw - continue execution even if logging fails
    }
  }
}

