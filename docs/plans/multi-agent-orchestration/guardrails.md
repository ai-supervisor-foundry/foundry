# Guard Rails (MVP)

Minimal, explicit controls to keep multi-agent orchestration deterministic, safe, and auditable without heavy telemetry.

## Summary

- Deterministic execution: Single control loop; no autonomous planning.
- Rule-based validation: Non-LLM checks; halt on ambiguity.
- Provider safety: Circuit breaker + ordered fallback.
- Data minimization: Role-scoped context; secrets redaction.
- Human checkpoints (opt-in): Stage approvals for high-risk flows.
- Lightweight telemetry: Per-task metrics only; no dashboards.
- Auditability: Append-only logs; state snapshots.
- Sandbox isolation: No cross-project access; explicit working dir.

## Mapping to Current Project

- Deterministic loop: See [docs/PROMPT.md](../../PROMPT.md) and [docs/LOOP.md](../../LOOP.md).
- Validation rules: See [docs/VALIDATION.md](../../VALIDATION.md) and helper-agent docs.
- Circuit breaker & fallback: Implemented in provider adapter; see plan notes and [governance addendum](governance-observability-enhancement.md).
- State access & minimization: See [docs/STATE_ACCESS.md](../../STATE_ACCESS.md); inject minimal, read-only snapshots.
- Secrets & redaction: Redact `.env`, `*.secret`, tokens; add prompt scrub step before dispatch (addendum).
- Human-in-the-loop: Optional per stage; see [governance addendum](governance-observability-enhancement.md).
- Logging & audit: See [docs/LOGGING.md](../../LOGGING.md); log dispatches, validations, diffs, halts.
- Sandbox: See [docs/SANDBOX.md](../../SANDBOX.md) and [docs/SANDBOX_LOCATION.md](../../SANDBOX_LOCATION.md).

## Minimal Additions for Multi-Agent MVP

1. Message contracts per agent role
   - Define input/output JSON schemas for roles.
   - Enforce before/after dispatch; reject non-conforming payloads.

2. Role-based fallback sets
   - Extend circuit breaker to role → provider list; log decisions.

3. Context allowlists + prompt scrubber
   - Per role: allowed state/files; remove secrets/PII patterns.

4. Optional stage approvals
   - Gate advancement when `requires_approval: true` on pipeline stages.

5. Lightweight telemetry fields
   - `provider_used`, `role`, `elapsed_ms`, `retries`, `cb_events`, `tokens_estimated` in per-task state.

See details in [governance-observability-enhancement.md](governance-observability-enhancement.md).
