# 01 — Local Helper Agent Routing

**Status:** COMPLETED — **Follow-up:** [02-helper-fallback-chain.md](../helper-agent/02-helper-fallback-chain.md)
**Priority:** Medium  
**Reference:** `docs/plans/done/helper-agent-local-model.md`

## Problem (code-verified)

- `helperAgentConfig.useLocalModel` / `USE_LOCAL_HELPER_AGENT` defined in `src/config/modelConfig.ts`
- Flag is **never read** — `commandGenerator.ts` always uses `cliAdapter.execute()` with the task's cloud provider
- `dispatchToOllama` only runs when `Provider.OLLAMA` is the task tool, not for helper calls

## Tasks

1. In `generateValidationCommands()` (or helper invocation site), check `helperAgentConfig.useLocalModel`
2. When true, route helper prompts to `dispatchToOllama` instead of primary `CLIAdapter`
3. Preserve existing behavior when flag is false (default)
4. Unit test: flag on → ollama called; flag off → cliAdapter called

## Acceptance Criteria

- `USE_LOCAL_HELPER_AGENT=true` routes helper agent to local Ollama
- No change to main task execution provider
- Document env vars in `supervisor-contexts/configuration.md`
