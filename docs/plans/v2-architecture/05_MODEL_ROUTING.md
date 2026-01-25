# V2 Module: Runtime Model Routing

**Status:** Planned
**Priority:** High (Phase 2)
**Replaces:** "Agent Personalities"

## 1. Overview
Instead of creating "Persona Agents", we implement **Runtime Model Routing**. The Scheduler assigns tasks to the most efficient model based on the *nature* of the task.

## 2. The Foundry 2026 Model Priority List

### A. Anthropic (The Engineering Specialist)
*   **Primary: Claude Opus 4.5**
    *   **Target Task:** Complex Implementation, Debugging, Critical Logic.
    *   **Why:** #1 on SWE-bench (80.9%). Best Cursor integration.
    *   **Context:** 200k.
*   **Secondary: Claude Sonnet 4.5**
    *   **Target Task:** Fast Coding, Refactoring, Daily Driver.
    *   **Why:** Balanced speed/intelligence.
*   **Legacy:** Claude 3.5 Sonnet (Fallback).

### B. Google (The Context Specialist)
*   **Primary: Gemini 3 Pro Preview**
    *   **Target Task:** Architecture, Legacy Migration, Full-Repo Analysis.
    *   **Why:** Massive context window (1M+). 35% higher accuracy on VS Code benchmarks than 2.5 Pro.
*   **Secondary: Gemini 3 Flash**
    *   **Target Task:** Documentation, Unit Tests, High-volume loops.
    *   **Why:** Speed/Cost ratio.
*   **Legacy:** Gemini 1.5 Pro (Fallback).

### C. OpenAI (The Reasoning Specialist)
*   **Primary: OpenAI o3**
    *   **Target Task:** Algorithm design, Security Audits, "Deep Thinking".
    *   **Why:** "Think before speak" architecture reduces hallucinations in critical logic.
*   **Secondary: GPT-5.1 Codex-Max**
    *   **Target Task:** General Coding, API integration.
    *   **Why:** Strong baseline, widely supported.

## 3. Configuration

We introduce a `TaskRoutingConfig` in `modelConfig.ts`:

```typescript
export const ROUTING_TABLE = {
  [TaskType.ARCHITECT]: Provider.GEMINI_3_PRO,
  [TaskType.CODING]: Provider.CLAUDE_OPUS_4_5,
  [TaskType.ALGORITHM]: Provider.OPENAI_O3,
  [TaskType.TESTING]: Provider.GEMINI_3_FLASH,
  [TaskType.REVIEW]: Provider.GEMINI_3_FLASH,
};
```

## 4. Implementation Logic

1.  **Task Enqueue:** User (or decomposition) sets `task.type`.
2.  **Scheduler Promotion:** When a task moves to `Ready`, the Scheduler checks `ROUTING_TABLE`.
3.  **Worker Assignment:** The Worker is initialized with the specific model client.
    *   *Note:* If the user has not configured API keys for a specific provider, fallback to the `DEFAULT_PROVIDER` (usually Claude Sonnet or GPT-4o).
