# Inventory of Hexagonal Architecture Violations

## Infrastructure Leaks in Application Layer
The following files in `src/application/services/controlLoop` directly import concrete implementations from `src/infrastructure`.

### CLIAdapter (LLM Client)
*   `src/application/services/controlLoop/index.ts`
*   `src/application/services/controlLoop/strategies/retry/retryOrchestrator.ts`
*   `src/application/services/controlLoop/strategies/retry/retryStrategy.ts`
*   `src/application/services/controlLoop/strategies/validation/helperAgentValidator.ts`
*   `src/application/services/controlLoop/strategies/validation/interrogationValidator.ts`
*   `src/application/services/controlLoop/modules/validationOrchestrator.ts`
*   `src/application/services/controlLoop/modules/taskExecutor.ts`
*   `src/application/services/controlLoop/modules/goalCompletionChecker.ts`

**Fix:** Create `LLMProviderPort` in `src/domain/ports/llmProvider.ts`.

### AuditLogger
*   `src/application/services/controlLoop/index.ts`
*   `src/application/services/controlLoop/strategies/retry/repeatedErrorStrategy.ts`
*   `src/application/services/controlLoop/strategies/halt/haltHandler.ts`
*   `src/application/services/controlLoop/modules/taskFinalizer.ts`

**Fix:** Create `AuditLogPort` in `src/domain/ports/auditLog.ts`.

### Logging (General & Prompt)
*   *Almost all files* import `src/infrastructure/adapters/logging/logger`.
*   `src/application/services/controlLoop/strategies/retry/retryOrchestrator.ts` imports `promptLogger`.
*   `src/application/services/controlLoop/strategies/retry/resourceExhaustedStrategy.ts` imports `promptLogger`.
*   `src/application/services/controlLoop/strategies/validation/helperAgentValidator.ts` imports `promptLogger`.
*   `src/application/services/controlLoop/modules/taskExecutor.ts` imports `promptLogger`.
*   `src/application/services/controlLoop/modules/goalCompletionChecker.ts` imports `promptLogger`.

**Fix:** Create `LoggerPort` in `src/domain/ports/logger.ts`.

### Command Execution (OS)
*   `src/application/services/controlLoop/strategies/validation/helperAgentValidator.ts` imports `commandExecutor`.

**Fix:** Create `CommandExecutorPort` in `src/domain/ports/commandExecutor.ts`.

### Persistence Layer
*   `src/application/services/controlLoop/modules/stateManager.ts` imports `PersistenceLayer`.
*   `src/application/services/controlLoop/modules/taskFinalizer.ts` imports `PersistenceLayer`.
*   `src/application/services/controlLoop/strategies/halt/haltHandler.ts` imports `PersistenceLayer`.

**Fix:** Create `PersistencePort` (or `StateRepository`) in `src/domain/ports/persistence.ts`.

## Domain Logic in Application Layer
The following "Strategies" define core business rules but reside in `src/application`.

### Validation Policies
*   `src/application/services/controlLoop/strategies/validation/*`
    *   `StandardValidator`
    *   `DeterministicValidator`
    *   `HelperAgentValidator`
    *   `InterrogationValidator`

**Fix:** Move to `src/domain/policies/validation/`.

### Retry Policies
*   `src/application/services/controlLoop/strategies/retry/*`
    *   `MaxRetriesStrategy`
    *   `RepeatedErrorStrategy`
    *   `ResourceExhaustedStrategy`

**Fix:** Move to `src/domain/policies/retry/`.

### Halt Policies
*   `src/application/services/controlLoop/strategies/halt/*`
    *   `HaltHandler` (contains logic for determining *when* to halt based on state)

**Fix:** Move to `src/domain/policies/halt/`.
