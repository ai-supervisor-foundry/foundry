## Proposed Fix

### 1. Set `current_task` when work starts

Location: After task retrieval, right after line 281 (after `taskRetrievalDuration` is calculated)

```typescript
// After line 281, add:
if (task) {
  state.current_task = task;
  logVerbose('ControlLoop', 'Set current_task', {
    iteration,
    task_id: task.task_id,
    intent: task.intent,
  });
}
```

This sets `current_task` immediately after retrieving a task (from retry_task or queue).

### 2. Clear `current_task` when no task available

Location: In the "no task" block, around line 294 (after setting `queue.exhausted = true`)

```typescript
// After line 294, add:
state.current_task = null;
logVerbose('ControlLoop', 'Cleared current_task (no task available)', { iteration });
```

### 3. Clear `current_task` when task completes

Location: Around line 1351 (in the task completion section, before persisting state)

```typescript
// After line 1351 (after clearing resource_exhausted_retry), add:
state.current_task = null;
logVerbose('ControlLoop', 'Cleared current_task (task completed)', {
  iteration,
  task_id: task.task_id,
});
```

### 4. Persist state after setting `current_task`

- When setting `current_task` at task start: persist state after setting it (or rely on the existing persist at task completion).
- When clearing `current_task`: the existing persist at line 1373 will include the cleared value.

### 5. Handle retry scenarios

- When a retry task is retrieved (line 244), `current_task` is already set by the logic above.
- When storing a task for retry (line 1298), keep `current_task` set to that task.

## Summary

- Set `state.current_task = task` when a task is retrieved and work begins.
- Set `state.current_task = null` when no task is available.
- Set `state.current_task = null` when a task completes successfully.
- The existing state persistence will capture these changes.

This keeps `current_task` in sync with the actual task being processed, so the UI shows the correct task.