# Plan: Automated "Living Window" Context Management

## Problem
The `supervisor-contexts` documentation is static and prone to staleness. The operator must manually update context files to keep the agent informed of architectural changes, leading to drift between the actual codebase state and the agent's understanding.

## Objective
Implement a **programmatic, automated context management system** ("The Living Window") that updates itself after every task completion. This ensures the Supervisor always has access to the most relevant, recent, and accurate context without manual intervention.

## Strategy: "Rolling Epics"
We will transition from static documentation to a dynamic memory bank managed by the Supervisor.

### 1. New Directory Structure (`supervisor-contexts/`)
We will restructure the existing folder:

```text
supervisor-contexts/
├── CONTEXT.md              # (Static) Immutable rules, Anti-Goals, Core Architecture principles.
├── active/                 # (Dynamic) The Sliding Window.
│   ├── current_status.md   # The "Now". Current Goal, Active Blocker, Last 5 Completed Tasks (Detailed).
│   └── decisions.log.md    # The last 10 significant architectural decisions.
└── archive/                # (Storage) Compressed history.
    ├── history.md          # Chronological 1-line summary of all past tasks.
    └── epics/              # (Optional) Weekly/Milestone summaries.
```

### 2. The `ContextManager` Service
A new Domain Service `src/domain/services/contextManager.ts` will be responsible for I/O operations on these markdown files.

#### Core Functions:
*   `updateContext(task: Task, result: ValidationReport): Promise<void>`
    *   Reads `active/current_status.md`.
    *   Appends the new task (ID, Intent, Summary) to the "Recent Tasks" section.
    *   **Pruning:** If "Recent Tasks" > 5 entries, moves the oldest to `archive/history.md` (summarized) and removes it from `active/current_status.md`.
    *   Updates "Last Updated" timestamp.
*   `recordDecision(decision: string): Promise<void>`
    *   Appends to `active/decisions.log.md`.
    *   Maintains a rolling window of ~10 items.

### 3. Integration with `TaskFinalizer`
We will hook `ContextManager` into `src/application/services/controlLoop/modules/taskFinalizer.ts`.

*   **Trigger:** Upon successful task completion (before or alongside Audit Log).
*   **Action:** `contextManager.updateContext(task, validationReport)`.

### 4. Integration with `PromptBuilder`
We will update `src/domain/agents/promptBuilder.ts` to inject this dynamic context.

*   **Current:** Reads `supervisor-contexts/CONTEXT.md` (manually).
*   **New:**
    1.  Read `supervisor-contexts/CONTEXT.md` (Base Rules).
    2.  Read `supervisor-contexts/active/current_status.md` (Immediate State).
    3.  Read `supervisor-contexts/active/decisions.log.md` (Recent Changes).
    4.  Combine into the System Prompt.

## Implementation Steps

### Phase 1: Structure & Migration
1.  Create `supervisor-contexts/active/` and `supervisor-contexts/archive/`.
2.  Initialize `active/current_status.md` with the current state (from Redis/Audit Log).
3.  Initialize `active/decisions.log.md`.

### Phase 2: Domain Service (`ContextManager`)
1.  Create `src/domain/services/contextManager.ts`.
2.  Implement markdown parsing/updating logic (simple string manipulation or AST if needed, likely regex/string split is sufficient).
3.  Implement `archive` logic.

### Phase 3: Wiring
1.  Inject `ContextManager` into `TaskFinalizer`.
2.  Call `updateContext` on task success.

### Phase 4: Prompt Consumption
1.  Update `PromptBuilder` to read from the `active/` directory.
2.  Update `BEHAVIORAL_TASKS_GUIDE.md` or similar to reflect that the agent now has "memory".

## Benefits
*   **Zero Maintenance:** Operator never needs to edit context files manually.
*   **Drift Prevention:** The agent always knows the last 5 things it did, preventing loops and regressions.
*   **Architectural Awareness:** Explicit "Decisions Log" keeps the agent aware of recent refactors (like the Hexagonal shift).
