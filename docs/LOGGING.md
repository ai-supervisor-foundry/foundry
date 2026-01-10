# Logging & Auditability

## Required Logs

Supervisor must log:
- task dispatched
- tool invoked (Agents/Providers: Gemini, Copilot, Cursor)
- deterministic validation outcome (including skips)
- provider run result
- helper agent invocation, duration, cache stats when available
- state diff (before/after)
- halt reason (if any)

## Log Rules

- Logs must be append-only and reviewable.

