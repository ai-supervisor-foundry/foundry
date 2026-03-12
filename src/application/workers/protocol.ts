// Worker IPC Message Protocol
// Defines the message types exchanged between supervisor (main process) and workers (child processes)

import { Task, ValidationReport, CompletedTask, BlockedTask } from '../../domain/types/types';

// --- Supervisor → Worker ---

export type WorkerCommand =
  | { type: 'TASK_ASSIGNED'; task: Task; worktreePath: string; config: WorkerConfig }
  | { type: 'SHUTDOWN' }
  | { type: 'HALT' };

// --- Worker → Supervisor ---

export type WorkerEvent =
  | { type: 'TASK_COMPLETED'; taskId: string; validationReport: ValidationReport; completedTask: CompletedTask }
  | { type: 'TASK_FAILED'; taskId: string; reason: string }
  | { type: 'TASK_BLOCKED'; taskId: string; reason: string; blockedTask: BlockedTask }
  | { type: 'READY' }
  | { type: 'HEARTBEAT' };

// --- Configuration passed to worker on task assignment ---

export interface WorkerConfig {
  sandboxRoot: string;
  redisHost: string;
  redisPort: number;
  stateKey: string;
  queueDb: number;
  providerStrategy: string;
  circuitBreakerTtl: number;
}
