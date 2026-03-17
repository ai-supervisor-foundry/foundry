---
description: Supervisor specifications, anti-goals, and hard constraints
---

# Core Principles

## Supervisor Specifications

- The supervisor does **not** define goals. Operator must inject goals.
- Scope **cannot** be expanded by AI.
- All tasks require explicit acceptance criteria.
- No task runs without validation.
- No refactoring without explicit instruction.
- State must be persisted after every step.
- Ambiguity halts execution (with retry mechanism).
- Provider CLIs are worker tools, not decision authority.
- **AUTO MODE is default and mandatory.**
- AUTO MODE cannot be disabled without operator instruction.
- No silent retries.
- All outputs are reviewable (diffs, logs).

## Anti-Goals (Do NOT Implement)

- Autonomous goal refinement
- Speculative task creation
- Retry heuristics (beyond explicit retry_policy)
- AI-based validation
- "Helpful" corrections
- Fallback behaviors

**If tempted → HALT.**
