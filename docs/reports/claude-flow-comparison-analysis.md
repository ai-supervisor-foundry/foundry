# Comparison Analysis: Foundry Plans vs. Claude Flow Teardown

**Date:** January 13, 2026
**Subject:** Reality Check - Plans vs. Competitor Implementation

## 1. Similarity & Convergence

The plans for Foundry and the implementation of Claude Flow converge on **Decomposition** and **Specialization**, but diverge significantly on **Execution**.

| Feature | Foundry (Planned) | Claude Flow (Implemented) | Verdict |
| :--- | :--- | :--- | :--- |
| **Orchestration** | **DAG-based** (Directed Acyclic Graph). Tasks have strict `depends_on`. | **Hierarchical** (Queen -> Worker). Logic is mostly "For Loop" or "Promise.all". | **Foundry is Better.** A real DAG (waiting/ready queues) is cleaner than nested loops. |
| **Roles** | `AgentRole` (Coder, Tester, etc.) defined in schema. | `AgentType` (Coder, Tester) defined in TS classes. | **Identical.** Everyone agrees specialized prompts = "Roles". |
| **Parallelism** | True parallel execution via `CursorCLI` subprocesses (up to 3). | `Promise.all` wrapping `claude` CLI processes. | **Similar.** Both rely on spawning OS processes. |
| **Validation** | **Deterministic** (Linters, Tests, File Checks). | **Simulated/Self-Reported** (Agent says "I'm done"). | **Foundry is Superior.** We check the *disk*; they check the *chat*. |

---

## 2. Better vs. Worse

### Where Foundry Plans are BETTER
1.  **Structural Concurrency:** Our `task-dependencies-parallel-execution.md` describes a "Dual Queue" (Ready/Waiting) system. This is an industrial-grade scheduler. Claude Flow's scheduler is essentially `await Promise.all(tasks)`, which is brittle (one failure might crash the group or hang the loop).
2.  **Provider Agnostic:** Our plan explicitly handles "Provider Profiles" (Cost/Rate Limits) for Gemini, OpenAI, and Anthropic. Claude Flow is hard-locked to Claude (obviously).
3.  **Artifact Passing:** We plan for explicit "Artifacts" (file paths, context) to be passed between DAG nodes. Claude Flow relies on shared file system state without explicit contracts.

### Where Foundry Plans are WORSE (Missing)
1.  **Safety Interceptors:** Claude Flow's `hooks/bash-hook.sh` is a **masterpiece of pragmatism**. It catches `rm -rf` and `git push` *before* the LLM executes them. We have "Guardrails" in docs, but no code. **We need to build this middleware immediately.**
2.  **UX / Feedback:** Claude Flow has a "Dashboard" (even if simple). Our plans are purely backend. We risk building a powerful engine with no steering wheel.

---

## 3. The "Waste" (What to Avoid)

After tearing down Claude Flow, I see several patterns we should **strictly avoid**:

1.  **"Simulation" Logic:**
    *   *The Waste:* Claude Flow has code that *pretends* to generate a REST API by writing a hardcoded "Hello World" string.
    *   *Why:* It looks good in a demo, but provides zero value to a developer who wants a *real* API.
    *   *Our Stance:* Never fake it. If the LLM fails, we fail.

2.  **Anthropomorphic Metrics:**
    *   *The Waste:* Tracking `agent.happiness` or `user.satisfaction`.
    *   *Why:* It's noise. It wastes CPU cycles and storage.
    *   *Our Stance:* Track `exit_code`, `test_pass_rate`, `tokens_used`. Hard engineering metrics only.

3.  **"Queen" / "Hive-Mind" Metaphors:**
    *   *The Waste:* Complex `Queen.ts` classes that just do a `for` loop.
    *   *Why:* It complicates the codebase. A `Supervisor` is a scheduler, not a monarch.
    *   *Our Stance:* Stick to `Scheduler`, `Queue`, `Worker`.

---

## 4. Strategic Recommendation

**Don't build "Multi-Agent" just to have "Agents". Build "Parallel Execution" to save time.**

*   **Pivot:** De-emphasize "Agent Personalities" (e.g., "The Grumpy Tester").
*   **Focus:** Emphasize "Parallel Pipelines" (e.g., "Run frontend and backend tasks at the same time").

**Immediate Action:**
1.  Implement the **Dual Queue** (Ready/Waiting) from `task-dependencies-parallel-execution.md`. This is the real engineering value.
2.  Steal the **Bash Hook** pattern.
3.  Ignore the "Vector Memory" and "Queen" logic.
