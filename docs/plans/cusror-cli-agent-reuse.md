## Analysis: Cursor CLI thread/agent reuse enhancements

### Current implementation

1. Task execution flow:
   - Each task spawns a new `cursor agent` process
   - No thread reuse — each execution is independent
   - Retries start fresh conversations
   - Thread IDs are not tracked

2. Current command structure:
   ```typescript
   cursor agent --print --force --output-format text --model <mode> <prompt>
   ```

### Cursor CLI thread management features

From the docs:
- `--resume [thread id]` — Continue from an existing thread
- `cursor-agent resume` — Resume the most recent conversation
- `cursor-agent ls` — List previous conversations
- History management — Conversations persist across sessions

### Enhancement opportunity: thread reuse by task_id

The adapter doesn't need to know about threads, but the layer below can reuse threads when the `task_id` is the same.

#### Benefits

1. Context preservation across retries:
   - Retries can continue the same conversation
   - Agent retains prior context and decisions
   - More efficient than starting fresh

2. Better error recovery:
   - Fix prompts can reference prior attempts
   - Agent can see what was tried before
   - Reduces redundant work

3. Cost efficiency:
   - Fewer tokens on retries (context already established)
   - Faster execution (less re-explanation)

#### Implementation approach

1. Thread ID tracking:
   - Store `thread_id` per `task_id` in state or a separate store
   - Map: `task_id → thread_id`
   - Persist thread IDs across supervisor restarts

2. Thread lifecycle:
   - First execution: start new thread, capture thread ID
   - Retries: use `--resume <thread_id>` instead of new prompt
   - Thread cleanup: optional cleanup after task completion

3. State schema extension:
   ```typescript
   // In SupervisorState or separate thread store
   task_threads: {
     [task_id: string]: {
       thread_id: string,
       created_at: string,
       last_used_at: string,
       attempt_count: number
     }
   }
   ```

4. Command modification:
   ```typescript
   // First attempt
   cursor agent --print --force --output-format text --model <mode> <prompt>
   // Capture thread_id from output or use cursor-agent ls
   
   // Retry attempt
   cursor agent --resume <thread_id> --print --force --output-format text --model <mode> <fix_prompt>
   ```

#### Technical considerations

1. Thread ID extraction:
   - Parse from Cursor CLI output
   - Use `cursor-agent ls` to find recent threads
   - Match by timestamp or metadata

2. Thread ID storage:
   - Option A: In supervisor state (simple, but adds to state size)
   - Option B: Separate Redis key (cleaner separation)
   - Option C: In task metadata (keeps it task-scoped)

3. Thread matching strategy:
   - By `task_id` (primary)
   - By `task_id + attempt_number` (if you want separate threads per attempt)
   - By `task_id + project_id` (for multi-project isolation)

4. Error handling:
   - If `--resume` fails (thread not found), fall back to new thread
   - Log thread reuse attempts
   - Handle thread expiration/cleanup

#### Implementation points

1. `cursorCLI.ts`:
   - Add `threadId?: string` parameter to `dispatchToCursor`
   - Modify command args to include `--resume` when `threadId` is provided
   - Extract thread ID from first execution output

2. `cliAdapter.ts`:
   - Pass thread ID through the adapter layer
   - Maintain thread ID mapping per task

3. `controlLoop.ts`:
   - Track thread IDs per task
   - Pass thread ID on retries
   - Store thread ID after first execution

4. State management:
   - Add thread tracking to state schema
   - Persist thread IDs with state
   - Clean up completed task threads (optional)

#### Example flow

```
Task: task-001 (first attempt)
  → cursor agent --print ... <prompt>
  → Extract thread_id: "thread_abc123"
  → Store: task_threads["task-001"] = "thread_abc123"
  → Validation fails

Task: task-001 (retry attempt 1)
  → Load thread_id: "thread_abc123"
  → cursor agent --resume thread_abc123 --print ... <fix_prompt>
  → Agent continues same conversation
  → Validation passes
  → Task complete (optional: cleanup thread)
```

#### Challenges and considerations

1. Thread ID extraction:
   - Cursor CLI may not explicitly return thread IDs
   - May need to use `cursor-agent ls` and match by timestamp
   - May require parsing output or using a different mechanism

2. Thread lifecycle:
   - When to clean up threads?
   - How long do threads persist in Cursor?
   - Handle thread expiration gracefully

3. Multi-project isolation:
   - Ensure threads don't leak between projects
   - Use project_id in thread matching

4. Backward compatibility:
   - Make thread reuse optional
   - Fall back to new threads if thread ID missing
   - Don't break existing workflows

### Recommended next steps

1. Research thread ID extraction:
   - Test `cursor agent` output format
   - Test `cursor-agent ls` format
   - Determine reliable thread ID source

2. Design thread storage:
   - Choose storage location (state vs. separate key)
   - Define thread metadata schema
   - Plan cleanup strategy

3. Implement incrementally:
   - Add thread ID tracking (no behavior change)
   - Add `--resume` support (opt-in)
   - Test with retry scenarios
   - Monitor for issues

4. Documentation:
   - Document thread reuse behavior
   - Update state schema docs
   - Add troubleshooting guide

### Conclusion

Thread reuse by `task_id` is feasible and beneficial. The adapter layer can remain unchanged while the underlying Cursor CLI integration adds thread management. This preserves context across retries, improves efficiency, and maintains backward compatibility.

The main unknowns are:
- How to reliably extract thread IDs from Cursor CLI
- Thread persistence and expiration behavior
- Best storage strategy for thread IDs