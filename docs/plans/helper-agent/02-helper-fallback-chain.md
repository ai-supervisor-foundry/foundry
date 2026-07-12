# 02 — Helper Agent Fallback Chain

**Status:** Not started  
**Priority:** Medium  
**Review:** Incorporated 2026-06-13 ([REVIEW-INSIGHTS.md](../REVIEW-INSIGHTS.md))

**Builds on:** [01-local-helper-routing.md](../done/helper-agent/01-local-helper-routing.md) (COMPLETED)

---

## Problem

| Path | Current behavior |
|------|------------------|
| `USE_LOCAL_HELPER_AGENT=false` | `cliAdapter.execute()` — **full secondary chain** already ✅ |
| `USE_LOCAL_HELPER_AGENT=true` | Direct `dispatchToOllama` — **no fallback** on exitCode≠0 ❌ |

Ollama returns failed `ProviderResult` (does not throw). Helper degrades silently; cloud never tried.

---

## Decision (docs reconciliation)

**Default: Option A** — keep `USE_LOCAL_HELPER_AGENT`; undeprecate in `supervisor-contexts/configuration.md`.

Option B (remove flag; Ollama order via `PROVIDER_STRATEGY` only) is a separate breaking change — not this plan.

Remove dead fields in `modelConfig.ts`: `fallbackToCloud`, `maxRetries` — delete or wire; do not leave unused.

---

## Solution

**Do not duplicate CLIAdapter's loop.** Reorder entries and execute via existing adapter:

```typescript
// commandGenerator.ts — when useLocalModel=true
const entries: ProviderEntry[] = [
  { provider: Provider.OLLAMA, agentMode: helperAgentConfig.localModelName },
  ...activeStrategy.secondary.filter(e => e.provider !== Provider.OLLAMA),
];
// Prefer reusing worker's secondaryAdapter with temporary entry list, or
// new CLIAdapter(redisClient, entries, ttl) sharing same circuitBreaker Redis key
helperResult = await helperAdapter.execute(prompt, sandboxCwd, agentMode, sessionId, featureId);
```

**Semantics (match existing secondary path):**
- CB skip → `continue` to next provider
- Exhaustion → return failed `ProviderResult` — **do not throw**
- Log each attempt (CLIAdapter already logs “Falling back to next provider”)
- Set prompt log `provider` from **actual** successful provider, not pre-execution guess

**Strategy 1 secondary (reference):** Cursor → Gemini → Ollama — not “→ Claude”.

---

## Affected files

| File | Change |
|------|--------|
| `commandGenerator.ts` | Replace `dispatchToOllama` branch with adapter chain |
| `modelConfig.ts` | Remove or wire dead fields |
| `supervisor-contexts/configuration.md` | Undeprecate flag (Option A) |
| `.env.example` | Document flag + `PROVIDER_STRATEGY` interaction |
| `commandGeneratorLocal.test.ts` | Ollama fail (exitCode 1) → next provider invoked |
| `helperAgentValidator.ts` | No throw path change expected |

**Reference (already correct):** `InterrogationValidator` uses secondary adapter chain only — no local bypass.

---

## Acceptance criteria

- [ ] Ollama fail → cloud secondary attempted
- [ ] `USE_LOCAL_HELPER_AGENT=false` unchanged
- [ ] Main task `primaryAdapter` unaffected
- [ ] No duplicate CB semantics vs `cliAdapter.ts`
- [ ] Integration test: mock Ollama fail → Gemini/Cursor called
- [ ] configuration.md aligned with code

---

## Out of scope

- Changing `primary` chain
- Helper-specific strategy table
