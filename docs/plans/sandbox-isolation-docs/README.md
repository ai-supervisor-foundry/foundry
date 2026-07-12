# Sandbox Isolation Docs — Plan Index

**Doc-only alignment:** correct stale multi-project claims (per-project state key / queue)
against the shipped single-supervisor model (`project_id` + shared Redis state/queue).

> Code-verified 2026-07-11. **No runtime changes** in this plan. Per-project Redis
> partitioning is explicitly out of scope (see [01-overview.md](./01-overview.md) § Out of scope).

## Sub-Plans

| # | File | Scope |
|---|------|-------|
| 1 | [01-overview.md](./01-overview.md) | Problem, truth table, out of scope |
| 2 | [02-edits.md](./02-edits.md) | Exact file edits, acceptance criteria |

## Status

| Phase | Scope | Status |
|-------|-------|--------|
| D | Doc drift fix (sandbox + task-schema) | **Not started** |

## Cross-links

- Canonical state model: [`supervisor-contexts/state-management.md`](../../../supervisor-contexts/state-management.md)
- Queue model: [`supervisor-contexts/queue-system.md`](../../../supervisor-contexts/queue-system.md)
- Related code plan (goals, not Redis keys): [prompt-context/04-per-project-goal-check](../prompt-context/04-per-project-goal-check.md)
- Shipped goals map: [done/per-project-goals.md](../done/per-project-goals.md)
