# 02b — Hybrid Memory Hardening

**Status:** Not started  
**Priority:** Medium  
**Review:** Incorporated 2026-06-13 ([REVIEW-INSIGHTS.md](../REVIEW-INSIGHTS.md))

**Builds on:** [02-hybrid-memory-fallback.md](../done/v2-architecture-gaps/02-hybrid-memory-fallback.md) (COMPLETED)

**Canonical backup path:** `{SANDBOX_ROOT}/state.json` (not per-project — corrects stale doc in shipped plan)

---

## Problem (code-verified)

| Gap | Current |
|-----|---------|
| Fallback trigger | Redis **null key** and GET **error** both load file |
| Staleness | No compare when Redis succeeds |
| Backup | Fire-and-forget; halt may exit before write completes |
| CLI | `sandboxRoot` not passed on halt/resume/set-goal/status/metrics |
| Envelope | Raw state JSON only — no `state_key` / timestamp |
| Tests | Assert null-key fallback — behavior hardening removes |

---

## Affected files

| File | Change |
|------|--------|
| `persistence.ts` | Fallback rules, envelope, halt sync write, operator warns |
| `cli.ts` | Pass `globalOpts.sandboxRoot` on **all** load/persist calls |
| `worker.ts` | Already passes sandboxRoot — verify |
| `persistence.test.ts` | Invert null-key test; add error-fallback, halt-sync tests |
| `done/.../02-hybrid-memory-fallback.md` | Path note: `{sandboxRoot}/state.json` |

### CLI commands needing `sandboxRoot` (audit)

| Command | loadState | persistState |
|---------|-----------|--------------|
| `init-state` | — | ✅ |
| `start` | ✅ | ✅ |
| `set-goal` | ❌ | ❌ |
| `halt` | ❌ | ❌ |
| `resume` | ❌ | ❌ |
| `status` | ❌ | — |
| `metrics` | ❌ | — |

All must use `globalOpts.sandboxRoot` (not rely on env alone).

---

## Tasks

**0. CLI wiring** — fix table above

**1. Fallback only on Redis GET error** — missing key → throw `State key … not found`

**2. Backup envelope:**
```typescript
interface StateBackupEnvelope {
  last_updated: string;      // ISO — copy from state.last_updated
  state_key: string;
  source: 'redis';
  state: SupervisorState;
}
```

**3. Dual-available warn** — after successful Redis load, if envelope file exists and `envelope.last_updated > state.last_updated` → `warnOperator`

**4. Halt sync write** — `await writeStateJsonBackup` when persisting HALTED status

**5. Backup failure** — `warnOperator` + `logError` (keep both)

**6. Tests** — GET error → fallback; null key → throw; halt → sync file exists

---

## Acceptance criteria

- [ ] Wrong/missing Redis key does not load stale file
- [ ] Halt exits with backup on disk
- [ ] Operator warned on stale envelope vs Redis
- [ ] All CLI paths pass sandboxRoot
- [ ] Tests match new semantics

---

## Out of scope

- Per-project state files
- Postgres replication (`infrastructure/01-dragonfly-pubsub-streams.md`)
