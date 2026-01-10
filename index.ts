// Supervisor - Main Entry Point
// Exports all public APIs

// Control Loop
export { controlLoop } from './src/application/services/controlLoop';
export type { SupervisorState, Task, ValidationReport, SupervisorStatus } from './src/domain/types/types';

// Persistence
export { loadState, persistState, PersistenceLayer } from './src/application/services/persistence';

// Queue
export { enqueueTask, dequeueTask, createQueue, getQueueKey, QueueAdapter } from './src/domain/executors/taskQueue';

// Prompt Builder
export { buildPrompt, PromptBuilder, MinimalState } from './src/domain/agents/promptBuilder';

// Cursor CLI
// export { dispatchToCursor, CursorCLI } from './src/cursorCLI'; // Deprecated/Moved? Checking...
export type { ProviderResult } from './src/domain/executors/haltDetection'; // Updated type name

// Validation
export { validateTaskOutput, Validator } from './src/application/services/validator';

// Halt Detection
export { checkHardHalts } from './src/domain/executors/haltDetection';
export type { HaltReason } from './src/domain/executors/haltDetection';

// Audit Logging
export { appendAuditLog, AuditLogger } from './src/infrastructure/adapters/logging/auditLogger';
export type { AuditLogEntry } from './src/infrastructure/adapters/logging/auditLogger';

// Types
export type {
  RetryPolicy,
  CompletedTask,
  BlockedTask,
  Decision,
  Artifact,
  ValidationCheck,
} from './src/domain/types/types';

