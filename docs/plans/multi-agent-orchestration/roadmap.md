# Implementation Roadmap (Detailed)

## Phase 1: Agent Role Specialization (≈2 weeks)
- Add `AgentRole` mapping and task schema fields (`agent_role`, `preferred_providers`).
- Implement role-aware provider selection in CLI adapter.
- Test mixed task types (code/docs/tests).

## Phase 2: Task Hierarchies (≈3 weeks)
- Extend schema with `subtasks` (sequential/parallel, depends_on).
- Track parent-child completion; enqueue subtasks per strategy.

## Phase 3: Collaboration Pipelines (≈4 weeks)
- Define `Pipeline` schema with stages, artifacts, dependencies.
- Implement pipeline executor, artifact passing, parallel stages, fail-fast.

## Phase 4: Ensemble Validation (≈2 weeks)
- Add `validation_strategy` (ensemble) with validators, consensus, confidence.
- Parallel validation, vote aggregation, issue rollup.

## Phase 5: Resource-Aware Scheduling (≈3 weeks)
- Provider resource profiles (cost, latency, rate limits, max_concurrent).
- Scheduler enforces constraints, prioritizes critical/blocked tasks, respects CB state.

## Success Measures (from INDEX)
- Faster completion, lower cost, higher validation accuracy, reduced rework, parallel efficiency, better utilization.
