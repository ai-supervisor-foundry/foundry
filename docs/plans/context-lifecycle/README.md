# Context Lifecycle — Plan Index

Task continuation across context limits, checkpoints, and halt-time dumps. Code-verified: session reset on token limit exists; no checkpoint dump or halt dump.

| # | File | Scope | Status |
|---|------|-------|--------|
| 1 | [01-checkpointing.md](./01-checkpointing.md) | Provider-agnostic checkpoint support | **Stub — needs spec** |
| 2 | [02-context-window-handoff.md](./02-context-window-handoff.md) | 90/95/98% checkpoints + agent context dump to sandbox | **Not started** |
| 3 | [03-halt-context-dump.md](./03-halt-context-dump.md) | Full context capture on halt to `./tmp/halt-dump/` | **Not started** |

**Suggested order:** 1 → 2 → 3
