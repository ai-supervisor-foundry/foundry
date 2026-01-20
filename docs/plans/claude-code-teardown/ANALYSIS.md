# Claude Flow Teardown Analysis

**Date:** January 13, 2026
**Subject:** Deep Analysis of `ruvnet/claude-flow`

## 1. Overview
Claude Flow is a "Queen-Worker" swarm orchestration system built specifically for the Anthropic ecosystem. It wraps the `claude` CLI tool and adds a layer of persistent state, memory, and coordination.

## 2. Core Architecture
- **Entry Point:** `src/cli/main.ts` bootstraps a custom CLI framework.
- **Orchestrator:** `SwarmCoordinator` (`src/swarm/coordinator.ts`) is the central brain. It manages a registry of Agents and Tasks.
- **Execution:** Tasks are executed either via `ClaudeFlowExecutor` (spawning `claude` CLI subprocesses) or via `simulateTaskExecution` (creating template files directly).
- **Communication:** Event-driven architecture using `EventEmitter` (`emitSwarmEvent`).

## 3. Key Findings

### A. The "Simulation" Reality
A significant portion of the "Task Execution" logic in `coordinator.ts` is actually **simulation**. Methods like `executeCodeGenerationTask` often write pre-defined "Hello World" or "REST API" templates to disk rather than dynamically generating code via an LLM. This suggests the "Swarm" capabilities might be more rigid/templated than advertised, or the dynamic part relies heavily on the `claude` CLI wrapper which is external.

### B. Memory is Optional
The `UnifiedMemoryManager` is a robust pattern. It attempts to load `agentdb` (Vector) and `better-sqlite3` (ReasoningBank), but silently falls back to `memory.json`. This makes the tool highly portable despite its "Enterprise" branding.

### C. MCP Integration
It acts as an MCP Server (hosting tools) but relies on the `@modelcontextprotocol/sdk`. It supports "MCP 2025" features (Async jobs), which is forward-looking.

### D. Safety Hooks
The `hooks/bash-hook.sh` is a standout feature. It intercepts CLI commands to add safety flags (e.g., `rm -i`) and correct paths. This is a pattern Foundry should adopt immediately.

## 4. Recommendations for Foundry

1.  **Adopt Safety Hooks:** Implement a middleware for `run_shell_command` that mimics `bash-hook.sh`.
2.  **Refine Agent State:** Expand our `Agent` model to include `capabilities` and `health`, preparing for multi-agent work.
3.  **Stay Deterministic:** The "Simulation" logic in Claude Flow confirms that "unsupervised swarms" often rely on hardcoded templates to work reliably. Foundry's approach of "Deterministic Execution" (checking the *actual* code) remains superior to generating templated boilerplate.
4.  **MCP Client:** We must implement an MCP Client to leverage the ecosystem, as Claude Flow's MCP integration is its strongest real feature.

## 5. Artifacts
- [Core Loop Analysis](./01_CORE_LOOP.md)
- [Memory Analysis](./02_MEMORY.md)
- [Swarm/Agent Analysis](./03_SWARM_AGENTS.md)
- [MCP Analysis](./04_MCP.md)
- [Hooks & Workflow](./05_HOOKS_WORKFLOW.md)
- [Scavenged Items](./06_SCAVENGED_ITEMS.md)
