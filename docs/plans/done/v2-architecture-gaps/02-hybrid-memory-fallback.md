# 02 — Hybrid Memory Fallback

**Status:** COMPLETED — **Follow-up:** [02-hybrid-memory-hardening.md](../../v2-architecture-gaps/02-hybrid-memory-hardening.md)
**Priority:** High  
**Depends on:** `docs/plans/done/v2-architecture/04_HYBRID_MEMORY.md`

## Problem (code-verified)

`src/application/services/persistence.ts` is DragonflyDB-only (full JSON blob GET/SET). No `state.json` fallback on Redis crash.

## Tasks

1. After every `persistState()`, async write to `{sandboxRoot}/state.json` (fire-and-forget)
2. On startup: if Redis unavailable, load from `state.json` and warn operator
3. Add `state.json` to `.gitignore`

## Acceptance Criteria

- State survives Redis crash (recovered from `state.json`)
- Human-readable state for debugging
- No measurable control-loop latency regression
