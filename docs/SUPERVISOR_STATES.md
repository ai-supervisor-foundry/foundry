# Supervisor States

## Explicit States

- `RUNNING`
- `BLOCKED`
- `HALTED`
- `COMPLETED`

## State Rules

- HALT always persists state first
- BLOCKED requires operator input to resume
- No automatic resume after ambiguity
- Operator input is the only unblock mechanism

