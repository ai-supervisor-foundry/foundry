---
description: Module roles, provider strategy, and separation of concerns
---

# Architecture

## Role Separation

- **Operator Interface** (`src/cli.ts`): Injects goals, tasks, HALT/RESUME commands
- **Supervisor Core** (`src/controlLoop.ts`): Owns control loop, state, validation orchestration
- **Tool Dispatcher** (`src/domain/agents/`, `src/infrastructure/connectors/`): Provider selection via ProviderStrategy, prompt construction, circuit breaker
- **Persistence Layer** (`src/persistence.ts`): DragonflyDB atomic read/write
- **Queue Adapter** (`src/queue.ts`): Redis List FIFO (LPUSH/RPOP)
- **Validator** (`src/validator.ts`): Deterministic rule-based validation
- **Audit Logger** (`src/auditLogger.ts`): Append-only JSONL logging
- **Logger** (`src/logger.ts`): PM2-compatible stdout, metrics, state tracking

## Provider Strategy

- Two adapters per strategy: **primary** (TaskExecutor, GoalChecker, Retry) and **secondary** (Validation helpers)
- Each `ProviderEntry` carries `{ provider, agentMode }`
- Active strategy via `PROVIDER_STRATEGY` env var (default: `'1'`)
- Circuit breaker + automatic fallback per adapter independently

**No module may cross responsibilities.**
