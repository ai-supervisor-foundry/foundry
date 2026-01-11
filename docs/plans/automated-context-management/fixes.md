# Fixes for Enhanced Runtime Context Injection

## Identified Gaps
The "Enhanced Runtime Context Injection" plan relies on displaying the `intent` of recent tasks to the agent. However, a review of `src/domain/types/types.ts` reveals that the `CompletedTask` interface **does not store the intent**.

**Current Interface:**
```typescript
export interface CompletedTask {
  task_id: string;
  completed_at: string;
  validation_report: ValidationReport;
}
```

Without the `intent` (e.g., "Create database schema"), the agent would only see opaque IDs (e.g., "task-005"), rendering the context largely useless for understanding the *semantic* history of the project.

## Required Implementation Fixes

### 1. Update Domain Types
**File:** `src/domain/types/types.ts`
**Action:** Add `intent` to `CompletedTask`.

```typescript
export interface CompletedTask {
  task_id: string;
  completed_at: string;
  intent: string; // NEW: Required for semantic context
  summary?: string; // OPTIONAL: For future use (LLM generated summary)
  validation_report: ValidationReport;
}
```

### 2. Update JSON Schemas
**Files:** `STATE_SCHEMA.json`, `TASK_SCHEMA.json` (if applicable)
**Action:** Reflect the new field in the schema definition to ensure validation passes and documentation is accurate.

### 3. Update Task Finalization Logic
**File:** `src/application/services/controlLoop/modules/taskFinalizer.ts`
**Action:** When creating the `completedTask` object to push to state, ensure the `task.intent` is copied over.

```typescript
// Pseudo-code for fix
const completedTask: CompletedTask = {
  task_id: task.task_id,
  completed_at: new Date().toISOString(),
  intent: task.intent, // <-- Capture this
  validation_report: report
};
```

### 4. Backward Compatibility
**Concern:** Existing entries in Redis (or `STATE.json`) will not have this field.
**Fix:** `PromptBuilder` must handle `undefined` intents gracefully (e.g., display "No intent recorded" or just the ID).

```typescript
// In PromptBuilder
state.completed_tasks.slice(-3).map(t => ({
  id: t.task_id,
  description: t.intent || "Description unavailable" 
}))
```

## Summary
The plan is sound, but **cannot be fully implemented** without first performing this schema migration. The immediate next step for any developer working on this plan is to execute Fixes #1-3.
