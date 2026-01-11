# Migration Guide

## v1.x -> Automated Context Management (Jan 2026)

### State Schema Changes
The `CompletedTask` object in `supervisor:state` has been enhanced to support automated context management.

**Old Schema:**
```json
{
  "task_id": "task-001",
  "completed_at": "...",
  "validation_report": { ... }
}
```

**New Schema:**
```json
{
  "task_id": "task-001",
  "completed_at": "...",
  "validation_report": { ... },
  "intent": "Implement login feature",  // New (Optional)
  "summary": "Completed: Implement login", // New (Optional)
  "requires_context": true              // New (Optional, feature toggle)
}
```

### Backward Compatibility
- **Auto-Backfill**: When loading old state, the system automatically backfills missing `intent` with `[Legacy] {task_id}` and sets `requires_context: false`.
- **Optional Fields**: The new fields are optional in the TypeScript interface, preventing runtime crashes with old state.

### Operational Changes
- **State Pruning**: The `completed_tasks` array is now capped at **100 items** in memory to prevent unlimited growth. Full history is preserved in `audit.log.jsonl`.
- **Context Injection**: The last 5 completed tasks and all active blockers are now **always** injected into the agent's prompt context.
