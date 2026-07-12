# 03 — Safety Layer E2E Tests

**Status:** Not started  
**Priority:** High  
**Depends on:** [01-safety-middleware.md](./01-safety-middleware.md)

## Tasks

Add `tests/e2e/safety-layer.test.ts`:

- Destructive command blocking (`rm -rf`, `dd`, `git push --force`)
- Secret redaction in logs
- Sandbox path confinement (`..` traversal blocked)
- Operator approve/deny flow (API test harness)

## Acceptance Criteria

- All risky patterns blocked or challenged
- No regression in existing unit tests
