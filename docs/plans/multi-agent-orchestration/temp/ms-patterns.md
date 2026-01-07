# Microsoft AI Agent Patterns: Handoff & Concurrent (Fit for Supervisor)

## Handoff Orchestration
- **Definition**: Dynamic delegation; each agent may pass control to a more specialized agent based on detected limits. One agent at a time; full control transfers.
- **When to use**: Unknown upfront order; expertise emerges during processing; dynamic routing signals; single active agent.
- **When to avoid**: Order known upfront; routing simple/deterministic; needs concurrency; risk of infinite bounce.
- **Example (CRM)**: Triage → technical → billing → human escalation.

**Fit for Supervisor**
- **Alignment**: Matches deterministic, single-active-agent control if routing is rule-based. Can sit atop our queue by treating handoff as a re-queue with role change.
- **Gaps/Risks**: Dynamic routing via LLM would violate determinism; need rule-based triggers (intent classification, error classes, confidence drops) plus circuit-breaker awareness to avoid loops.
- **Guardrails to apply**: Message contracts per role; handoff budget (max hops); audit log entries for handoff reason; CB/fallback aware of new role; optional human stop for repeated bounces.

## Concurrent Orchestration
- **Definition**: Multiple agents run in parallel on same task/input; results aggregated or consumed independently.
- **When to use**: Parallelizable tasks; ensemble/quorum/voting; time-sensitive latency gains; independent perspectives.
- **When to avoid**: Needs sequential dependency; deterministic reproducibility from fixed order; shared mutable state contention; no clear conflict resolution; resource/quotas tight.
- **Example (stock analysis)**: Fundamental + technical + sentiment + ESG in parallel; aggregate to a recommendation.

**Fit for Supervisor**
- **Alignment**: Matches our planned parallel ready/waiting queues and ensemble validation concept. Deterministic if aggregation is rule-based (majority/quorum, weighted scores) and state writes are serialized post-aggregation.
- **Gaps/Risks**: Shared mutable state while agents run—must isolate outputs (per-agent artifacts) then merge after validation; need deterministic tie-breakers; enforce global concurrency and cost caps.
- **Guardrails to apply**: Per-agent sandboxes/output paths; deterministic aggregator; circuit breaker per provider; quotas and max_parallel in task config; audit each agent run and merge decision.

## Implementation Hooks for Our Plan
- **Routing**: Handoff uses rule-based router (intent/criteria) before dispatch; concurrent uses scheduler with max_parallel and provider caps.
- **State**: No live shared writes; consolidate after validation; use state snapshots per agent role as read-only context (per STATE_ACCESS).
- **Contracts**: Role-specific IO schemas; reject non-conformant payloads.
- **Telemetry**: Per-attempt metrics (provider_used, role, elapsed_ms, retries, cb_events, tokens_estimated); aggregate decision logged.
- **Safety**: Handoff hop limit; concurrency conflict policy (fail-fast vs pick-highest-confidence); optional human approval for risky flows.

## Recommendations
1. **Handoff MVP**: Add rule-based router (intent + error class) with hop limit; re-queue task with new role; log reason; reuse circuit breaker per role.
2. **Concurrent MVP**: Enable parallel fan-out for tasks marked parallelizable; capture per-agent outputs; add deterministic aggregator (vote/score); apply serialized commit.
3. **Docs Link**: Tie back to [governance-observability-enhancement.md](../governance-observability-enhancement.md) and [guardrails.md](../guardrails.md) for contracts, CB, and approvals.
