# Plan: Fix Behavioral Support & Schema Gaps

## Problem
The implementation of behavioral task support is incomplete. Critical gaps exist in schema validation, task type detection, and interrogation logic, leading to potential instability for conversational tasks.

## Identified Gaps

1.  **Schema Mismatch**: `TASK_SCHEMA.json` was not updated to include the `task_type` field, causing inconsistency with `types.ts`.
2.  **Detection Logic**: `detectTaskType` in `promptBuilder.ts` does not identify behavioral tasks (defaults to 'implementation'), rendering the routing logic in `validator.ts` ineffective for auto-detected tasks.
3.  **Interrogation Parsing**: The JSON parsing robustness fix (markdown stripping) applied to `commandGenerator.ts` was not applied to `interrogator.ts`.
4.  **Interrogation Logic**: The interrogation phase asks for "file paths" even for behavioral tasks, which is illogical and leads to confusion.

## Proposed Solutions

### 1. Update JSON Schema
Modify `TASK_SCHEMA.json` to include the `task_type` enum definition.

```json
"task_type": {
  "type": "string",
  "enum": ["coding", "behavioral", "configuration", "testing", "documentation", "implementation", "refactoring"]
}
```

### 2. Enhance Task Detection
Update `detectTaskType` in `src/domain/agents/promptBuilder.ts` to sniff behavioral intent.

```typescript
// Keywords: greet, hello, say, respond, explain, who are you
if (lowerInstructions.match(/\b(greet|hello|say|respond|explain|who are you)\b/)) {
  return 'behavioral';
}
```

### 3. Fix Interrogation Parsing
Update `src/domain/executors/interrogator.ts` to use the `findJSONInString` helper (copy or import) to handle Markdown-wrapped responses.

### 4. Skip/Adapt Interrogation for Behavioral Tasks
Modify `interrogator.ts` or `controlLoop.ts` to:
- **Option A (Simpler)**: Skip interrogation entirely if `task_type === 'behavioral'` (Phase 3.1).
- **Option B (Better)**: Ask different questions ("What did you say?") instead of "Where is the file?".

*Decision*: For this fix, **Option A** (Skip) is safer and aligns with the reviewer's Phase 3.1 note.

## Implementation Steps

1.  **Edit `TASK_SCHEMA.json`**: Add `task_type`.
2.  **Edit `promptBuilder.ts`**: Update `detectTaskType`.
3.  **Edit `interrogator.ts`**:
    *   Add `findJSONInString`.
    *   Update `parseInterrogationResponse`.
4.  **Edit `controlLoop.ts`**:
    *   Add check: `if (task.task_type === 'behavioral') needsInterrogation = false;` (or similar logic).

## Verification
1.  Enqueue a task "Say hello" (without explicit `task_type` to test auto-detection).
2.  Verify `task_type` is detected as 'behavioral'.
3.  Verify it passes validation via `validateBehavioralTask`.
4.  Verify it *skips* interrogation if validation fails (or if we force a failure case).
