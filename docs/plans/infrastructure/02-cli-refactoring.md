# CLI Architecture Analysis & Refactoring Proposal

## Current State Assessment

**File:** `src/application/entrypoint/cli.ts`
**Length:** 944 lines (Jan 10, 2026)
**Responsibilities:**
1.  **CLI Configuration:** using `commander` to define flags, options, and help text.
2.  **Command Implementation:** Contains the full business logic for state mutation (`init-state`, `set-goal`, `halt`, `resume`), queue operations (`enqueue`), and reporting (`status`, `metrics`).
3.  **Composition Root:** The `start` function acts as the application's dependency injection container, initializing all services (`PersistenceLayer`, `QueueAdapter`, `CLIAdapter`, `Validator`, etc.) and wiring them together.
4.  **Logging Wrappers:** Local wrappers for verbose and performance logging.

## Issues Identified

1.  **Violation of Single Responsibility Principle (SRP):**
    The file handles *how* to parse user input (CLI flags) and *what* to do with it (Business Logic).
    
2.  **Testability:**
    Testing the logic of "enqueuing a task" currently requires invoking the CLI function or extracting the logic. Unit testing the command handlers independently is cleaner if they are decoupled from `commander`.

3.  **Readability & Maintenance:**
    As the number of commands grows (e.g., adding `retry`, `clear-queue`, `export-logs`), this file will become unmanageable. The `start` function alone is becoming complex with environmental configuration and service wiring.

4.  **Reusability:**
    The command logic (e.g., `setGoal`, `enqueue`) might be useful for other entry points (e.g., a future REST API or Admin UI) but is currently bound to the CLI module.

5.  **Behavioral Drift Risk:**
    `start` mixes DI, Redis client creation, audit logger wiring, env parsing, and control loop invocation. Any change risks regressions because there is no seam to test start-up independently.

6.  **Test Coverage Gaps:**
    No unit seams for per-command logic (enqueue/status/metrics). Each command spins its own Redis client, making isolation awkward.

## Refactoring Proposal

I recommend breaking this file down into a modular structure.

### 1. Extract Command Handlers (`src/application/commands/`)
Move the implementation logic into dedicated "Command Handler" functions or classes. These should accept pure arguments (not `commander` option objects).

*   `src/application/commands/stateCommands.ts`: `initState`, `setGoal`, `halt`, `resume`
*   `src/application/commands/queueCommands.ts`: `enqueue`
*   `src/application/commands/reportingCommands.ts`: `status`, `metrics`
*   `src/application/commands/lifecycleCommands.ts`: `start` (containing the composition root logic)

**Adjustments to fit current code:**
- Include `resume` and `metrics` explicitly; both exist in the current CLI.
- Split lifecycle into `start.ts` only; halt/resume belong with state commands.

### 2. Extract Composition Root (`src/application/bootstrap.ts`)
The `start` function contains critical setup logic. This should be extracted into a `bootstrap` or `createSupervisor` factory function that returns the initialized services. This allows:
*   Easier integration testing (spin up the app without the CLI).
*   Better visibility into system dependencies.

**Shape suggestion:**
```ts
export interface AppServices {
    stateClient: Redis;
    queueClient: Redis;
    persistence: PersistenceLayer;
    queue: QueueAdapter;
    promptBuilder: PromptBuilder;
    cliAdapter: CLIAdapter;
    validator: Validator;
    auditLoggerFactory: (projectId: string) => AuditLogger;
}

export async function bootstrap(opts: BootstrapOptions): Promise<AppServices> { /* wire deps */ }
```

### 3. Simplify Entrypoint (`src/application/entrypoint/cli.ts`)
The `cli.ts` file should remain as the **Interface Layer**. Its only job should be:
*   Define the program version and description.
*   Define commands and flags.
*   Parse arguments.
*   Call the appropriate Command Handler with the parsed arguments.

**Exit policy:** Handlers should throw; only `cli.ts` decides on `process.exit` / codes.

## Proposed Directory Structure

```text
src/
├── application/
│   ├── commands/           # Pure business logic for actions
│   │   ├── state/
│   │   │   ├── initState.ts
│   │   │   ├── setGoal.ts
│   │   │   ├── halt.ts
│   │   │   └── resume.ts
│   │   ├── queue/
│   │   │   └── enqueue.ts
│   │   ├── reporting/
│   │   │   ├── status.ts
│   │   │   └── metrics.ts
│   │   └── lifecycle/
│   │       └── start.ts
│   ├── entrypoint/
│   │   └── cli.ts          # Definitions only (Commander)
│   └── setup/
│       └── bootstrap.ts    # Dependency Injection & Service wiring
```

## Benefits
*   **Decoupling:** CLI concerns are separated from application logic.
*   **Scalability:** New commands can be added by creating a new handler file and one line in `cli.ts`.
*   **Clarity:** The `cli.ts` file becomes a clear manifest of available capabilities.

---

## Gaps in Original Proposal (addressed above)
- Line count understated (944, not ~630).
- `resume` and `metrics` commands were not explicitly placed.
- No DI shape; added `AppServices` + `bootstrap` contract suggestion.
- No testing guidance; see below.

## Testing Strategy (per module)
- **Handlers**: unit test with mocked deps (no Commander types). Example: enqueue validates tasks and enqueues N items given a fake queue adapter.
- **bootstrap**: integration test with in-memory Redis or a lightweight test double to ensure wiring succeeds and returns all services.
- **cli.ts**: thin smoke test to assert commands are registered; avoid business logic here.

## Migration Plan (low-risk, incremental)
1) Extract handlers for state/queue/reporting (no behavior change). Wire `cli.ts` to new handlers.
2) Extract `bootstrap.ts`; move start-up wiring there; keep `start` handler calling `bootstrap`.
3) Slim `cli.ts` to parsing + dispatch only; keep per-command Redis client creation minimal.
4) Add unit tests for handlers; add one integration test for `start` using `bootstrap`.

## Success Criteria
- Behavior parity: commands produce same outputs/side-effects as before.
- `cli.ts` shrinks to ~200 lines (definitions + dispatch).
- Handlers are Commander-free and accept typed args + deps.
- `start` wiring lives in `bootstrap.ts`; control loop invocation remains unchanged in behavior.
