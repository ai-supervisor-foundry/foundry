---
description: JSONL audit logging, required log events, and reviewability rules
---

# Logging & Auditability

## Required Logs

Supervisor must log:
- Task dispatched
- Tool invoked
- Validation result
- State diff (before/after)
- Halt reason (if any)
- Interrogation rounds
- Helper Agent commands
- Goal completion checks

## Log Rules

- Logs must be **append-only and reviewable**
- Audit logs: JSONL format in `sandbox/<project-id>/audit.log.jsonl`
- Prompt logs: JSONL format in `sandbox/<project-id>/logs/prompts.log.jsonl`
- Verbose logs: PM2 stdout/stderr (captured in `logs/supervisor-out.log` and `logs/supervisor-error.log`)

## Log Types

- **Audit Logs**: High-level events, state transitions, validation results
- **Prompt Logs**: Full prompts and responses sent to/received from agents
- **Verbose Logs**: Detailed application logic, performance metrics, state transitions
