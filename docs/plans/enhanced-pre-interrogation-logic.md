# Enhanced Pre-Interrogation & Conditional Logic Strategy

## Overview
This document outlines a strategy to optimize the Interrogator by making it more adaptive and efficient. The goal is to reduce token consumption and latency by halting interrogation rounds when success is unlikely or when the agent explicitly admits failure.

## Core Configuration
- **Max Rounds:** 2 (reduced from 4).
- **Rationale:** If an agent cannot locate its own implementation within 2 targeted rounds (especially with deterministic feedback), further rounds are highly likely to result in hallucinations.

## Conditional Logic Strategies

### 1. Early Exit on Explicit "Not Started"
- **Trigger:** If the agent returns `status: "NOT_STARTED"` or `status: "INCOMPLETE"` for a criterion in any round.
- **Action:** Immediately remove that criterion from the `unresolvedCriteria` pool for subsequent rounds.
- **Benefit:** Prevents redundant questioning for work that the agent admits isn't there.

### 2. "Stop the Line" Threshold
- **Trigger:** If 100% of interrogated criteria are marked `INCOMPLETE` or `NOT_STARTED` in Round 1.
- **Action:** Halt the entire interrogation session immediately and return the current failures.
- **Benefit:** Saves an entire LLM round when it's clear the task was not attempted or was completely missed.

### 3. Deterministic Feedback Loop (Round 2 Specific)
- **Condition:** If Round 1 failed due to `Files not found`.
- **Action:** Round 2 prompt must explicitly mention the missing paths:
  > "You claimed implementation was in `X`, but that path does not exist. Please provide the correct path or admit if it was not implemented."
- **Constraint:** If Round 2 still provides a non-existent path, the criterion is marked `FAILED` with no further retries.

### 4. Categorical Short-Circuit
- **Trigger:** If a criterion is identified as a "Design/Planning" task (no files expected).
- **Logic:** If the agent provides a coherent explanation but no files, mark as `UNCERTAIN` and move to human/supervisor review instead of looping for file paths.

## Success Metrics
- **Token Savings:** ~50% reduction in interrogation-related LLM calls.
- **Latency:** Faster task failure detection.
- **Precision:** Higher confidence in "Complete" vs "Incomplete" status.
