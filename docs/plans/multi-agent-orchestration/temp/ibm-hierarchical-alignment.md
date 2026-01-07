# IBM Hierarchical AI Agents — Alignment Notes (Supervisor + MAO)

Reference: IBM Think topic on hierarchical AI agents (manager/worker structures). This document paraphrases and extracts fit-for-purpose ideas aligned with our deterministic, operator-controlled Supervisor and Multi-Agent Orchestration (MAO) plan.

## Pattern Essence (Paraphrased)
- **Manager → Worker hierarchy**: A manager agent decomposes a goal into sub-tasks, assigns to specialized workers, and integrates results. Multi-level hierarchies possible (manager-of-managers), but must be bounded.
- **Deterministic handoffs**: Control passes one hop at a time based on capability boundaries/signals. The manager owns routing and quality gates.
- **Ledger & checkpoints**: Maintain a task ledger (plan, steps, statuses, reasons). Progress advances via explicit checkpoints and acceptance criteria.
- **Governance baked-in**: Least-privilege data access, audit trails, escalation to humans, and safety constraints at each level.

## Alignment With Supervisor
- **Determinism & Control**: Supervisor already owns the control loop and routing. We keep workers as tools invoked via provider CLIs. No agent self-routing.
- **Task Hierarchies**: Matches our roadmap item for operator-defined task/subtask trees. The “manager” role maps to Supervisor itself; workers map to role-specialized agent providers.
- **Validation Flow**: Our deterministic validator and helper agent fit the maker-checker gates at each checkpoint.
- **Guardrails**: Message contracts, circuit breaker, fallback, and human approvals align with IBM’s emphasis on governance and escalation.
- **Auditability**: We already maintain logs and state snapshots; a task ledger view is a thin layer on existing logs.

## Enhancements Borrowed (Minimal, MVP-first)
1. **Task Ledger (Lightweight)**
   - Structure: `plan_id`, `goal`, array of `steps[{id, role, input_refs, acceptance_criteria, status, evidence, started_at, completed_at, reason}]`.
   - Storage: piggyback on existing state snapshots; append-only audit log for updates.
   - Use: drive checkpoint approvals and postmortems.

2. **Deterministic Capability Routing**
   - Rule-based router selects role by intent/criterion match, not LLM intuition.
   - Signals: task type, file scope, validator hints, error classes, circuit-breaker state.
   - Hop limits to prevent bounce loops; re-queue with `role` change.

3. **Manager-Driven Checkpoints**
   - Each subtask requires acceptance criteria and a validator route.
   - Optional `requires_approval: true` for maker-checker stages (security, payments).
   - Failed gates trigger retry or escalation, never silent pass-through.

4. **Least-Privilege Context**
   - Role-scoped allowlists for state/files; secrets redaction before dispatch.
   - Workers receive minimal read-only snapshots.

5. **Concurrency Discipline in Hierarchies**
   - Allow parallel subtasks only when independent; serialize commits via aggregator/gate.
   - Deterministic conflict resolution (vote/weight) before state mutation.

## Risks To Avoid (Per IBM Guidance, Adapted)
- **Unbounded recursion**: Enforce depth and hop limits; detect cycles and halt.
- **Autonomous planning**: Manager never delegates planning to LLMs; the operator or Supervisor defines the plan.
- **Mutable shared state**: No concurrent writes; isolate artifacts, merge post-validation.
- **Opaque routing**: All handoffs must have a logged reason and rule that triggered them.
- **Cost/Quota overruns**: Apply per-role quotas, global `max_parallel`, and circuit breakers.

## Concrete Hooks In Our System
- **Router**: Extend dispatcher to map `task.role` using rule tables; record `routing_reason` (intent match, error class, cb_open).
- **State**: Add a `task_ledger` section to state snapshots; reuse existing `STATE.json` serialization.
- **Validator**: Ensure subtask acceptance criteria are deterministic and tied to validator routes; use helper agent where needed.
- **Approvals**: Gate specific steps with `requires_approval`; halt until operator approves.
- **Telemetry**: Minimal fields per attempt (`provider_used`, `role`, `elapsed_ms`, `retries`, `cb_events`, `tokens_estimated`).

## MVP Actions (Small, Shippable)
1. Define role catalog + routing rules in config (intent keywords, file patterns, task_type → role).
2. Add `task_ledger` to state + append-only audit updates for each step.
3. Implement hop limit + reason logging for any role handoff.
4. Add `requires_approval` support at step-level; pause/resume flow.
5. Keep concurrency off by default for hierarchies; enable opt-in with deterministic aggregator if steps are independent.

## References To Local Docs
- Governance & guardrails: ../governance-observability-enhancement.md, ../guardrails.md
- Core controls: ../../VALIDATION.md, ../../LOGGING.md, ../../STATE_ACCESS.md, ../../SANDBOX.md, ../../PROMPT.md
- MAO roadmap context: ../INDEX.md, ../extensions.md, ../roadmap.md

