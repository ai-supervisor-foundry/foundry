---
description: Master index linking all Foundry system documentation sections
---

# Supervisor System - Context Index

The Supervisor is a **persistent orchestration layer for AI-assisted software development**—restart-safe, operator-controlled, fully auditable.

## Quick Links

| Section | File |
|---------|------|
| Overview & Software Factory | [overview.md](./overview.md) |
| Core Principles & Anti-Goals | [core-principles.md](./core-principles.md) |
| Architecture & Role Separation | [architecture.md](./architecture.md) |
| Control Loop | [control-loop.md](./control-loop.md) |
| State Management | [state-management.md](./state-management.md) → [schema detail](./state-schema-detail.md) |
| Task Schema | [task-schema.md](./task-schema.md) |
| Queue System | [queue-system.md](./queue-system.md) |
| Validation | [validation.md](./validation.md) |
| Tool Contracts | [tool-contracts.md](./tool-contracts.md) → [prompt construction](./tool-prompt-construction.md) |
| Sandbox Enforcement | [sandbox-enforcement.md](./sandbox-enforcement.md) |
| Ambiguity Handling | [ambiguity-handling.md](./ambiguity-handling.md) |
| Recovery Actions | [recovery-actions.md](./recovery-actions.md) |
| Logging & Auditability | [logging-auditability.md](./logging-auditability.md) |
| DragonflyDB Constraints | [dragonflydb-constraints.md](./dragonflydb-constraints.md) |
| Resource Exhaustion | [resource-exhaustion.md](./resource-exhaustion.md) |
| Goal Completion Check | [goal-completion-check.md](./goal-completion-check.md) |
| Installation & Setup | [installation-setup.md](./installation-setup.md) |
| Usage & Workflow | [usage.md](./usage.md) → [advanced ops](./usage-advanced.md) |
| Key Components | [key-components.md](./key-components.md) |
| Configuration | [configuration.md](./configuration.md) |
| PM2 Integration | [pm2-integration.md](./pm2-integration.md) |
| Sandbox Structure | [sandbox-structure.md](./sandbox-structure.md) |
| Final Instruction | [final-instruction.md](./final-instruction.md) |

## Workflow Summary

```
Operator: Boilerplates + Tasks + Goal → Supervisor: Execute → Validate → Persist → Continue
```

## Critical Rules

- Operator injects goals; supervisor does not define them.
- Scope cannot be expanded by AI.
- All tasks require explicit acceptance criteria.
- State persisted after every step.
- Ambiguity halts execution.
- If unspecified → STOP and ask operator.
