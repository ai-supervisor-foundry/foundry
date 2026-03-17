---
description: Quick reference to all major modules and their source files
---

# Key Components

- **Operator Interface** (`src/cli.ts`): CLI commands for operator control
- **Supervisor Core** (`src/controlLoop.ts`): Main control loop
- **Tool Dispatcher** (`src/cursorCLI.ts`, `src/promptBuilder.ts`, `src/cliAdapter.ts`): CLI integration
- **Persistence Layer** (`src/persistence.ts`): DragonflyDB state management
- **Queue Adapter** (`src/queue.ts`): Redis List-based task queue
- **Validator** (`src/validator.ts`): Deterministic validation
- **Interrogator** (`src/interrogator.ts`): Sequential Q&A for validation clarification
- **Command Generator** (`src/commandGenerator.ts`): Helper Agent for validation commands
- **Audit Logger** (`src/auditLogger.ts`): Append-only logging
- **Prompt Logger** (`src/promptLogger.ts`): Detailed prompt/response logging
- **Logger** (`src/logger.ts`): Centralized verbose logging
