# Foundry V2: Industrial Architecture Plan

**Status:** Draft
**Date:** January 13, 2026
**Based on:** 
- Competitor Analysis (`claude-flow`)
- Internal Parallel Execution Plans
- Existing UI/UX Implementation

## 1. Executive Summary

This plan outlines the architecture for **Foundry V2**, pivoting from a single-threaded "Supervisor" to a **Parallel, Safety-First Industrial Control Plane**.

We have successfully audited `claude-flow` and identified key "Scavengeable" patterns (Safety Hooks, Memory Fallback) while rejecting their "Waste" (Simulation, Anthropomorphism). We also acknowledge our existing React-based Dashboard (`UI/`) provides superior observability compared to CLI-only tools, and V2 will double down on feeding this UI with structured, real-time events.

**The V2 Core Thesis:**
> "Don't build 'Personalities'. Build 'Pipelines'. Don't 'Simulate' safety. Enforce it."

## 2. Core Philosophy & Shifts

| Area | V1 (Current) | V2 (Target) | Why? |
| :--- | :--- | :--- | :--- |
| **Execution** | Sequential (FIFO Queue). | **Parallel DAG** (Ready/Waiting Queues). | Speed. Tasks often don't block each other. |
| **Safety** | Implicit (Trust the Prompt). | **Explicit Middleware** (Bash Hooks). | LLMs make mistakes. `rm -rf` should require a "sudo" check. |
| **Tooling** | Custom Wrappers (`fs`, `shell`). | **MCP Client** (Standard Protocol). | Access to 100+ external tools without maintenance burden. |
| **Memory** | Redis-only (Strict). | **Hybrid Persistence** (Redis + JSON Fallback). | Portability & Resilience. Easier to debug locally. |
| **UX** | CLI Logs + Polling UI. | **Event-Driven UI**. | The Dashboard (`UI/`) needs real-time granular status updates. |

## 3. Architecture Modules

The V2 Architecture is broken down into five distinct, independently shippable modules. See the sub-documents for implementation details.

### [01. The Safety Layer](./01_SAFETY_LAYER.md)
**Objective:** Intercept every tool call (Shell, FS) *before* execution.
**Key Feature:** "Bash Hook" Middleware (stolen from `claude-flow`) that sanitizes commands, warns on secrets, and blocks destructive actions (rm, dd) unless explicitly authorized.

### [02. The Parallel Scheduler](./02_PARALLEL_SCHEDULER.md)
**Objective:** Move from `Queue<Task>` to `Graph<Task>`.
**Key Feature:** A **Dual-Queue System** (Ready vs. Waiting). Tasks with unmet dependencies sit in `Waiting`. When dependencies resolve, they promote to `Ready`. Up to 3 `Ready` tasks run concurrently via isolated Provider Workers.

### [03. The MCP Integration Strategy](./03_MCP_STRATEGY.md)
**Objective:** Stop maintaining custom tool definitions.
**Key Feature:** Implement an **MCP Client** within the Supervisor. Allows Foundry to connect to *any* MCP Server (Github, Slack, Postgres) and expose those tools to the Agent dynamically.

### [04. Hybrid Memory Strategy](./04_HYBRID_MEMORY.md)
**Objective:** Make state portable and debuggable without losing performance.
**Key Feature:** Primary state in DragonflyDB (Redis) for speed/locks. Automatic background sync to `state.json` (or SQLite in future) for portability. *Explicit rejection of Vector Memory (AgentDB) to avoid context pollution.*

### [05. Runtime Model Routing](./05_MODEL_ROUTING.md)
**Objective:** Maximize ROI by routing tasks to the best model.
**Key Feature:** A routing table that sends "Architect" tasks to **Gemini 3 Pro** (Context), "Implementation" to **Claude Opus 4.5** (Coding), and "Logic" to **OpenAI o3** (Reasoning). *Replaces "Agent Personalities".*

## 4. Implementation Phasing

### Phase 1: Safety First
*   **Goal:** Secure the current V1 loop.
*   **Action:** Implement `CommandSanitizer` middleware.
*   **Outcome:** `run_shell_command` is safe. Secrets are redacted.

### Phase 2: The Scheduler Engine
*   **Goal:** Unlock parallelism.
*   **Action:** Refactor `ControlLoop` to use `TaskGraph`. Implement `WaitingQueue`.
*   **Outcome:** Tasks can depend on each other. Independent tasks run in parallel.

### Phase 3: MCP Adoption
*   **Goal:** Expand toolset.
*   **Action:** Build `MCPClientAdapter`. Connect `fs` tools via MCP.
*   **Outcome:** Standardized tooling.

### Phase 4: UI Real-time Feeds
*   **Goal:** Make the V2 engine visible.
*   **Action:** Emit `TaskPromoted`, `SafetyWarning`, `WorkerStarted` events to Redis/Websockets for the Frontend.

---

**Next Steps:**
1. Approve this high-level direction.
2. Review the sub-documents for technical specs.
3. Begin Phase 1 (Safety Layer).