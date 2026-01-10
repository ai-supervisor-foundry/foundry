# External Framework Analysis Index

This directory contains detailed analyses of external AI agent orchestration frameworks and patterns, evaluated for alignment with the Supervisor's deterministic, operator-controlled multi-agent model.

## Framework Analyses

### 1. **Microsoft Azure Patterns** → [ms-patterns.md](ms-patterns.md)
- **Scope**: Handoff orchestration (dynamic delegation, rule-based routing, hop limits) and Concurrent orchestration (parallel execution, deterministic aggregation).
- **Alignment**: Strong fit for our rule-based routing and fallback chains.
- **Key Insights**: 
  - Dynamic delegation with explicit hop limits prevents runaway cascades.
  - Circuit breaker awareness and message contracts are critical guardrails.
  - Deterministic aggregation for concurrent tasks matches our state model.
- **MVP Hooks**: Hop limits, message contracts, CB integration.

### 2. **IBM Hierarchical Agents** → [ibm-hierarchical-alignment.md](ibm-hierarchical-alignment.md)
- **Scope**: Manager→worker hierarchy, task ledger/checkpoints, governance-first posture, least-privilege context.
- **Alignment**: Manager = Supervisor; workers = stateless provider executors; ledger = audit logs.
- **Key Insights**:
  - Hierarchical control with checkpoints at each stage prevents autonomous drift.
  - Lightweight task ledger mirrors our queue/state model.
  - Least-privilege context injection aligns with our smart context snapshots.
- **MVP Hooks**: Lightweight task ledger, rule-based routing rules, manager-driven checkpoints.

### 3. **GeeksforGeeks Multiagent Planning** → [multiagent-planning-gfg.md](multiagent-planning-gfg.md)
- **Scope**: Centralized vs. distributed planning, agent components (agents, environment, communication, collaboration), techniques (distributed problem-solving, protocols).
- **Alignment**: Centralized planning with distributed execution; knowledge sharing via snapshots; validation gates = coordination.
- **Key Insights**:
  - Centralized planning (Supervisor) + distributed execution (providers) is optimal for determinism.
  - Communication protocols (message contracts) enforce consistency.
  - Adaptation happens via CB/fallback, not autonomous learning.
- **MVP Hooks**: Message contracts, snapshot-based knowledge sharing, deterministic coordination.

### 4. **AWS Agent-Squad Framework** → [agent-squad-analysis.md](agent-squad-analysis.md)
- **Scope**: Production-grade orchestration framework with Orchestrator, Classifier, unified Agent interface, dual-level storage, Retrievers, SupervisorAgent for team coordination.
- **Alignment**: **Highest-value integration**. Orchestrator = Supervisor; unified interface = provider abstraction; dual-level storage = global + role-scoped context.
- **Key Deviations**: LLM classifier (replace with rule-based), dynamic agent discovery (use static roles), implicit autonomy (enforce stateless).
- **Key Insights**:
  - Configuration-driven control (AgentSquadConfig) maps to our operator-defined roles and routing.
  - Per-user/session scoping provides multi-tenant safety.
  - SupervisorAgent enables hierarchical team coordination (align with handoff patterns).
  - Pluggable storage backends support future scaling (DragonflyDB, DynamoDB, custom).
- **MVP Hooks**: Orchestrator abstraction, unified agent interface, dual-level storage, per-user/session scoping, error classification, fallback precedence.

---

## Synthesis & Recommendations

### Framework Selection Rationale

**Agent-Squad** is the **primary integration target** because:
1. **Production maturity**: AWS Labs project with comprehensive TypeScript/Python implementations.
2. **Minimal deviations**: Only LLM classifier needs replacement (rule-based router).
3. **Strong abstractions**: Orchestrator, unified Agent interface, storage pluggability match our architecture.
4. **Rich configuration**: AgentSquadConfig gives operators fine-grained control (logging, retries, history limits, fallback behavior).
5. **Extensibility**: Custom classifiers, agents, retrievers, and storage allow deterministic implementations.

**Microsoft + IBM patterns** provide **conceptual validation**:
- Handoff patterns confirm hop limits and explicit routing.
- Hierarchical model confirms manager→worker + checkpoints.
- Both reinforce importance of message contracts and determinism.

**GeeksforGeeks planning** provides **theoretical grounding**:
- Centralizes planning for determinism; validates our architecture.
- Emphasizes communication protocols (message contracts) and knowledge isolation.

---

## MVP Implementation Map

Based on all four framework analyses, here's the prioritized implementation roadmap:

### Phase 1: Adopt Agent-Squad Abstractions (Foundation)
1. **RuleBasedClassifier**: Replace Agent-Squad's LLM classifier with intent router (keywords, error patterns, CB state).
2. **Unified Agent Interface**: Standardize input/output per role (enforce in `cliAdapter`).
3. **Dual-Level Storage**: Separate classifier routing logs from agent conversation histories.
4. **Per-User/Session Scoping**: Isolate state, queue, and audit logs by user + session.

### Phase 2: Add Validation & Checkpoints (Governance)
1. **Validation Checkpoint**: Post-agent-response gate (acceptance criteria + optional approval).
2. **Error Classification**: Categorize errors (transient, provider, validation, unknown) and log recovery path.
3. **Fallback Precedence**: Explicit fallback lists per role; always log choice and reason.

### Phase 3: Formalize Routing & Handoff (Control)
1. **Message Contracts**: Define strict I/O schemas per role; reject non-conformant payloads.
2. **Hop Limits**: Implement circuit breaker per provider + hop counter (prevent cascades).
3. **Explicit Handoff Graph**: Operator predefines allowed role-to-role transitions; no dynamic routing.

### Phase 4: Retrievers & Context Injection (Safety)
1. **Retriever Pattern**: Formalize context pulling as role-scoped "retrievers" with allowlists.
2. **Secret Redaction**: Move redaction to retriever (not at dispatch); enforce in retriever logic.
3. **Role Isolation**: Verify that role A cannot see role B's context; audit retriever calls.

---

## Key Guardrails (Cross-Framework Consensus)

All four frameworks emphasize:
- ✅ **Message Contracts**: Strict schemas per role → prevent invalid inputs/outputs.
- ✅ **Deterministic Routing**: Rule-based not LLM → reproducible and auditable.
- ✅ **Hierarchical Control**: Manager (Supervisor) owns state; workers (providers) are executors.
- ✅ **Per-User/Session Isolation**: Prevent context leakage across users or sessions.
- ✅ **Explicit Checkpoints**: Validation gates + optional approvals for high-risk operations.
- ✅ **Error Classification & Fallback Logs**: Every recovery is auditable; no silent failures.
- ✅ **Least-Privilege Context**: Agents see only necessary state (snapshots, not full state).
- ✅ **Communication Protocols**: Hop limits, message timeouts, retry policies enforced.

---

## File Structure

```
multi-agent-orchestration/
├── INDEX.md (this file)
├── ms-patterns.md (Microsoft Azure handoff & concurrent patterns)
├── ibm-hierarchical-alignment.md (IBM hierarchical AI agent patterns)
├── multiagent-planning-gfg.md (GeeksforGeeks multiagent planning)
└── agent-squad-analysis.md (AWS Agent-Squad framework deep dive + MVP hooks)
```

---

## Next Steps

1. **Code Review**: Validate Agent-Squad integration with existing `cliAdapter`, `promptBuilder`, and state manager.
2. **RuleBasedClassifier Implementation**: Build deterministic intent router; test coverage for all intent classes.
3. **Message Contracts**: Define I/O schemas per role; add validation in adapter.
4. **Dual-Level Storage**: Separate classifier vs. agent storage; verify per-user/session isolation.
5. **Validation Checkpoint**: Implement post-response gate with acceptance criteria and optional approval.
6. **Testing**: End-to-end tests covering routing, validation, fallback, and error recovery paths.

---

**Last Updated**: Latest agent-squad-analysis.md expanded with orchestrator configuration, API functions, and request processing pipeline details.
