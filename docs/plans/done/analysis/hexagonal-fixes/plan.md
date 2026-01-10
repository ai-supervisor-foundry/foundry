# Hexagonal Refactoring Plan

## Objective
Align the current `src/application` architecture with strict Hexagonal (Ports & Adapters) principles by:
1.  Decoupling `Application` from `Infrastructure` via Interface Ports.
2.  Moving Business Rules (Strategies) from `Application` to `Domain`.

## Phase 1: Port Definitions (The API)
Define the interfaces that the Application and Domain layers will use. These go in `src/domain/ports/`.

*   **Task:** Create `src/domain/ports/llmProvider.ts`
    *   Interface for `CLIAdapter`.
*   **Task:** Create `src/domain/ports/logger.ts`
    *   Interface for `Logger` and `PromptLogger`.
*   **Task:** Create `src/domain/ports/auditLog.ts`
    *   Interface for `AuditLogger`.
*   **Task:** Create `src/domain/ports/commandExecutor.ts`
    *   Interface for `CommandExecutor`.
*   **Task:** Create `src/domain/ports/persistence.ts`
    *   Formalize the `PersistenceLayer` interface (if not already strictly defined).

## Phase 2: Domain Enrichment (The Core)
Move the "brain" of the control loop into the Domain layer. The Application layer becomes the "nervous system" connecting the brain to the limbs (Infrastructure).

*   **Task:** Create `src/domain/policies/`
*   **Task:** Move `src/application/services/controlLoop/strategies/validation/*` -> `src/domain/policies/validation/`
    *   *Refactor:* Update them to use `LLMProviderPort`, `CommandExecutorPort`, `LoggerPort` instead of concrete imports.
*   **Task:** Move `src/application/services/controlLoop/strategies/retry/*` -> `src/domain/policies/retry/`
    *   *Refactor:* Update imports to use Ports.
*   **Task:** Move `src/application/services/controlLoop/strategies/halt/*` -> `src/domain/policies/halt/`
    *   *Refactor:* Update imports to use Ports.

## Phase 3: Infrastructure Adaptation (The Plugs)
Ensure existing infrastructure adapters implement the new Ports.

*   **Task:** Update `src/infrastructure/adapters/agents/providers/cliAdapter.ts` to implement `LLMProviderPort`.
*   **Task:** Update `src/infrastructure/adapters/logging/logger.ts` to implement `LoggerPort`.
*   **Task:** Update `src/infrastructure/adapters/logging/auditLogger.ts` to implement `AuditLogPort`.

## Phase 4: Application Wiring (The Switchboard)
Update the `controlLoop` modules to inject dependencies rather than importing them.

*   **Task:** Refactor `src/application/services/controlLoop/modules/*` classes.
    *   Constructor injection for `LoggerPort`, `LLMProviderPort`, etc.
*   **Task:** Refactor `src/application/services/controlLoop/index.ts`.
    *   This file effectively acts as a factory/orchestrator. It needs to accept the dependencies (passed from the composition root) and instantiate the modules.

## Phase 5: Composition Root (The Start)
Update the entry point to wire the graph.

*   **Task:** Update `src/application/entrypoint/cli.ts`.
    *   Instantiate `RealLogger`, `RealCLIAdapter`, etc.
    *   Pass them into `controlLoop`.

## Verification
*   **Task:** Run `npx tsc --noEmit` to ensure type safety.
*   **Task:** Run tests (mocking the new Ports will be much easier!).
