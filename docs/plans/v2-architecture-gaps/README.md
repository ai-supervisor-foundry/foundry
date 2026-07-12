# V2 Architecture — Remaining Gaps

Extracted from [done/v2-architecture-implementation-status.md](../done/v2-architecture-implementation-status.md). Scheduler + model routing are complete; these are the open modules.

| # | File | Scope | Status |
|---|------|-------|--------|
| 1 | [01-safety-middleware.md](./01-safety-middleware.md) | ToolMiddleware pipeline, secret redaction, operator approval | **Not started** (~20% via commandExecutor whitelist) |
| 2 | [02-hybrid-memory-fallback.md](../done/v2-architecture-gaps/02-hybrid-memory-fallback.md) | Async `state.json` sync + Redis crash recovery | **COMPLETED** |
| 2b | [02-hybrid-memory-hardening.md](./02-hybrid-memory-hardening.md) | Fallback rules, envelope, halt sync write | **Not started** |
| 3 | [03-safety-e2e-tests.md](./03-safety-e2e-tests.md) | E2E tests for safety layer | **Not started** |

**Suggested order:** 1 → 3 → 2b
