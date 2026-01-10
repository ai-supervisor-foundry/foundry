// Port: Logger
// Interface for system logging

import { PromptLogType } from '../enums/promptType';

export interface LoggerPort {
  log(module: string, message: string, ...args: unknown[]): void;
  logVerbose(component: string, message: string, data?: Record<string, unknown>): void;
  logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void;
  logStateTransition(from: string, to: string, context?: Record<string, unknown>): void;
  logError(module: string, message: string, error?: unknown): void;
}

export interface PromptLogEntry {
  task_id: string;
  iteration: number;
  type: PromptLogType | string; // Allow string to ease strictness, or strictly Enum
  content: string;
  metadata?: Record<string, unknown>;
}

export interface PromptLoggerPort {
  appendPromptLog(
    sandboxRoot: string,
    projectId: string,
    entry: PromptLogEntry
  ): Promise<void>;
}
