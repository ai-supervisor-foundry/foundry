# Governance & Observability Addendum (MVP Scope)

**Status**: Draft  
**Intent**: Add minimal governance and observability for multi-agent orchestration without over-instrumenting the MVP.  
**Principle**: Preserve deterministic, operator-controlled execution; add only the guardrails needed for safety and auditability.

---

## Context (What Exists)
- **Deterministic control loop**: Sequential task execution, explicit validation, operator-provided tasks/goals.
- **Provider circuit breaker**: TTL-based failure tracking and fallback ordering.
- **Helper/Interrogation agents**: Separation of concerns for validation and clarification.
- **Audit logs**: Append-only logs in sandbox; prompt logs per task.

## Enhancements (MVP, Low-Telemetry)
1. **Message Contracts (Agent IO Schema)**
   - Define allowed fields per agent handoff (task_id, role, instructions, acceptance_criteria, context_paths, artifacts).
   - Forbid free-form agent-to-agent messaging; all exchanges mediated by supervisor.
   - Context inclusion list per agent role to minimize leakage (goal excerpt, task, selected state slices).

2. **Agent-Level Fallback Sets**
   - Extend circuit breaker to agent role: if preferred provider trips CB, fall back to secondary providers for that role.
   - Record fallback decisions in audit log (provider chosen, reason=cb_open or error_class).

3. **Data Scope & Redaction**
   - Per agent-role data policy: what state/files may be injected; redact secrets (.env, *.secret) by default.
   - Optional scrub step on prompts to drop PII-like patterns and secrets before dispatch.

4. **Human-in-the-Loop Checkpoints (Opt-In)**
   - Stage-level approvals for high-risk pipelines (security review, payments, auth). Operator must approve before advancing.
   - If approval not configured, continue current automatic flow.

5. **Lightweight Telemetry (MVP)**
   - Per-task fields: provider_used, role, elapsed_ms, retries, cb_events (boolean), tokens_estimated (if available from provider).
   - No dashboards yet; write into audit log row and state snapshot for later analysis.

6. **Reliability Notes**
   - Dependency health check before dispatch (ensure required artifacts/stage outputs exist).
   - Retry budget remains per-task; no self-healing beyond existing loop.

## Out of Scope (For Now)
- Full SLA enforcement, alerts, dashboards.
- Decentralized/federated orchestration.
- Adaptive autonomous routing (keep rule-based selection).

## Integration Points
- **Control Loop**: Insert message-contract enforcement before prompt build; attach agent-fallback selection to dispatcher.
- **State**: Persist lightweight telemetry fields per task and provider fallback decisions.
- **Validator**: Optionally enforce role-specific acceptance checks (e.g., security reviewer must sign off for critical tasks).

## Minimal Implementation Steps
1. Add agent IO contract definitions and validation (reject non-conformant payloads).
2. Extend circuit breaker logic to role-based fallback sets and log decisions.
3. Add prompt scrubber for secrets/PII and enforce role-based context allowlist.
4. Add optional stage approvals flag in pipeline/subtask configs; gate progression when set.
5. Log minimal telemetry fields (provider_used, role, elapsed_ms, retries, cb_events, tokens_estimated).
