# Key Components

High-level map of the main modules. For role separation and boundaries, see [architecture.md](./architecture.md).

| Component | Location | Role |
|-----------|----------|------|
| **Operator Interface** | `src/cli.ts` | CLI entry: init-state, set-goal, enqueue, start, halt, resume, status. Operator control only. |
| **Supervisor Core** | `src/controlLoop.ts` | Main loop: load state → pick task → dispatch → validate → persist. Owns state read/write and validation orchestration. |
| **Tool Dispatcher** | `src/domain/agents/`, `src/infrastructure/connectors/agents/providers/` | Builds provider prompts, injects state, selects provider via strategy (Cursor, Gemini, Claude, etc.). |
| **Persistence Layer** | `src/persistence.ts` | DragonflyDB read/write, state serialization, atomic updates. |
| **Queue Adapter** | `src/queue.ts` | Redis List (LPUSH/RPOP), FIFO task ordering, queue state. |
| **Validator** | `src/validator.ts` | Deterministic checks: file existence, content patterns, test runs, acceptance criteria. |
| **Interrogator** | `src/interrogator.ts` | Sequential Q&A when validation is uncertain; gathers clarification from the agent. |
| **Command Generator** | `src/commandGenerator.ts` | Helper agent: generates read-only validation commands when deterministic checks fail. |
| **Audit Logger** | `src/auditLogger.ts` | Append-only JSONL: state diffs, events, task lifecycle. |
| **Prompt Logger** | `src/promptLogger.ts` | Logs full prompts and responses for debugging. |
| **Logger** | `src/logger.ts` | Central logging, PM2-friendly stdout, metrics, state transitions. |
