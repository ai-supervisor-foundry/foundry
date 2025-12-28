// Supervisor - Main Entry Point
// Exports all public APIs

// Control Loop
export { controlLoop } from './src/controlLoop';
export type { SupervisorState, Task, ValidationReport, SupervisorStatus } from './src/types';

// Persistence
export { loadState, persistState, PersistenceLayer } from './src/persistence';

// Queue
export { enqueueTask, dequeueTask, createQueue, getQueueKey, QueueAdapter } from './src/queue';

// Prompt Builder
export { buildPrompt, PromptBuilder, MinimalState } from './src/promptBuilder';

// Cursor CLI
export { dispatchToCursor, CursorCLI } from './src/cursorCLI';
export type { CursorResult } from './src/haltDetection';

// Validation
export { validateTaskOutput, Validator } from './src/validator';

// Halt Detection
export { checkHardHalts, containsAmbiguity } from './src/haltDetection';
export type { HaltReason } from './src/haltDetection';

// Recovery
export { detectRecoveryScenario, handleRecoveryScenario } from './src/recovery';
export type { RecoveryScenario, RecoveryDetection } from './src/recovery';

// Audit Logging
export { appendAuditLog, AuditLogger } from './src/auditLogger';
export type { AuditLogEntry } from './src/auditLogger';

// Output Parsing
export { parseCursorOutput } from './src/outputParser';
export type { ParsedOutput } from './src/outputParser';

// Types
export type {
  RetryPolicy,
  CompletedTask,
  BlockedTask,
  Decision,
  Artifact,
  ValidationCheck,
} from './src/types';

