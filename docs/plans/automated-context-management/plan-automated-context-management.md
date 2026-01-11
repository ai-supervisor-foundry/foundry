# Plan: Enhanced Runtime Context Injection

## Problem
The original plan to implement "Automated Context Management" via dynamic markdown files (`active/`, `archive/`) was reviewed and rejected. It violated architectural principles (domain services performing I/O), conflicted with existing structures (`windows/`), and introduced unnecessary complexity.

However, the core need remains: **Agents need better "short-term memory" to avoid repeating mistakes or losing context.**

Currently, `PromptBuilder` only injects deep history if specific keywords (e.g., "extend", "build on") are detected. Otherwise, it only provides the single most recent completed task. This "Recency Bias" is often insufficient for complex, multi-step implementations where the agent needs to know what happened in the last few steps to maintain continuity.

## Objective
Enhance the Supervisor's `PromptBuilder` to provide a robust, reliable "Sliding Window" of recent history (last 3-5 tasks) and active blockers in *every* prompt, regardless of keyword triggers. This ensures the agent is always aware of its immediate context without requiring file I/O or autonomous documentation updates.

## Strategy: "State-Derived Context"

We will modify `src/domain/agents/promptBuilder.ts` to derive rich context directly from the existing `SupervisorState` (Redis) at runtime.

### 1. Enhance `buildMinimalState` Logic
We will adjust the context injection logic to be more generous with context, as modern models (Gemini 1.5 Pro, etc.) have ample context windows.

*   **Recent Tasks:** Instead of 1 task (default) or 5 tasks (keyword-triggered), we will **always** inject the last **3-5 completed tasks**.
    *   *Why?* Helps the agent see the trajectory of the work (e.g., "Created file", "Added test", "Fixing test").
    *   *Fields:* `task_id`, `completed_at`, `intent` (if available), and potentially a brief `summary` if we decide to store it.
*   **Blocked Tasks:** We will **always** inject the list of currently blocked tasks.
    *   *Why?* Prevents the agent from re-attempting blocked work or accidentally depending on blocked components.

### 2. Update `MinimalState` Interface
Ensure the interface reflects the richer data we want to pass.

```typescript
export interface MinimalState {
  // ... existing fields
  completed_tasks?: Array<{
    task_id: string;
    completed_at: string;
    intent?: string; // Add intent for better context
    result?: string; // Add result summary if available
  }>;
  blocked_tasks?: Array<{
    task_id: string;
    reason: string;
  }>;
}
```

### 3. Refine `buildPrompt` Presentation
Ensure this data is presented clearly in the Markdown output.

```markdown
## READ-ONLY CONTEXT
{
  "project": { ... },
  "recent_history": [
    { "task_id": "task-5", "intent": "Setup DB", "status": "completed" },
    { "task_id": "task-6", "intent": "Create Schema", "status": "completed" },
    { "task_id": "task-7", "intent": "Run Migration", "status": "completed" }
  ],
  "active_blockers": []
}
```

## Implementation Steps

1.  **Modify `src/domain/agents/promptBuilder.ts`**:
    *   Update `buildMinimalState` to remove the restrictive `shouldExtend` logic (or make it the default).
    *   Always slice the last 3-5 tasks from `state.completed_tasks`.
    *   Always map `state.blocked_tasks`.
2.  **Verify `SupervisorState` Data**:
    *   Ensure `completed_tasks` in Redis actually stores `intent`. If not, we might need to rely on just `task_id` or update the state storage logic (separate task). *Note: `STATE_SCHEMA.json` suggests `completed_tasks` structure needs verification.*
3.  **Test**:
    *   Generate prompts for sample tasks.
    *   Verify the "Recent History" section appears and is accurate.

## Benefits
*   **Architecturally Sound:** No new services, no file I/O in domain layer.
*   **Reliable:** Uses the "Single Source of Truth" (Redis State).
*   **Zero Latency:** No file parsing overhead.
*   **Operator Control:** We are not asking the AI to write its own history; we are simply showing it the system's record of its actions.

## Future Considerations (Fallback)
If external tools (outside the Supervisor) need this context in a file, we can implement a `ContextPersistencePort` in the Application layer to dump `session-state.json` (as per the Review's "Option B"). For now, the in-memory solution is sufficient for the Agent's needs.