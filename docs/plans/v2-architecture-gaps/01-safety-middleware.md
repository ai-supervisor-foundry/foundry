# 01 — Safety Middleware Pipeline

**Status:** Not started  
**Priority:** Critical  
**Depends on:** `docs/plans/done/v2-architecture/01_SAFETY_LAYER.md`

## Problem (code-verified)

Only partial protection exists in `src/infrastructure/connectors/os/executors/commandExecutor.ts` (whitelist + blocked patterns). No middleware chain, no secret redaction, no operator approval UI.

## Tasks

1. Define `ToolMiddleware` interface — `src/domain/tooling/middleware.ts`
2. Implement `ShellSafetyMiddleware` — block `rm -rf`, `dd`, `git push --force`; moderate-risk prompts
3. Implement `SecretGuardMiddleware` — redact ENV secrets from logs/output
4. Implement `PathConfinementMiddleware` — enforce `SANDBOX_ROOT`, block `..` traversal
5. Route tool calls through middleware chain in execution path
6. Emit `SafetyChallenge` events for HIGH-risk commands → UI modal (`UI/src/components/SafetyChallenge.tsx`)

## Acceptance Criteria

- Agent cannot run destructive commands without operator approval
- Secrets in ENV redacted from logs
- E2E coverage in [03-safety-e2e-tests.md](./03-safety-e2e-tests.md)
