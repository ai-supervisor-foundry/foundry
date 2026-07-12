# 01 — Tiered Memory & Context Compaction

## Source Files
- `crates/arc-core/src/memory/mod.rs` — MemoryManager orchestrator
- `crates/arc-core/src/memory/working.rs` — WorkingMemory (4-block layout)
- `crates/arc-core/src/memory/compressor.rs` — LLM-based summarization
- `crates/arc-core/src/compaction.rs` — Multi-phase ContextCompactor
- `crates/arc-compact/src/sliding_window.rs` — Token-budget eviction
- `crates/arc-compact/src/summarize.rs` — Summarization prompt

## What to Extract

### A. 4-Block Working Memory Model (MemGPT-inspired)

Context window is structured as 4 ordered blocks:
1. **system_prompt** — pinned first, never evicted
2. **core_blocks** — named slots: `user_profile`, `agent_persona`, `task_context`, `scratchpad`
3. **observation_log** — compressed history from prior turns
4. **recent_buffer** — verbatim last N messages (VecDeque, default 10)

Each block is wrapped in XML tags (`<core_memory:user>`, `<observation_log>`).
Build order: System → Core Blocks → Observation Log → Recent Messages.

### B. MemoryConfig Schema

```typescript
interface MemoryConfig {
  contextBudget: number;         // max tokens in working memory
  compressionThreshold: number;  // 0.85 = compress at 85% fill
  recentBufferSize: number;      // default 10 messages
  persistenceEnabled: boolean;
}
```

### C. Multi-Phase Compaction Pipeline

`ContextCompactor` runs 3 phases in order:
1. **StripMedia** — remove image/binary content blocks
2. **TruncateToolOutputs** — cap tool output to 50k chars (FIFO protection)
3. **Summarize** — LLM-based summarization of oldest messages

Protected by a circuit breaker (3 failures → 60s cooldown → half-open probe).

### D. Token Budget Constants

```typescript
const TOKEN_BUDGET = {
  maxContextTokens: 200_000,
  compactionThreshold: 0.85,    // trigger at 170k
  protectionWindow: 50_000,     // never compress last 50k tokens
  maxOutputTokens: 16_384,
};
```

### E. Observation Log Compression

- `appendObservations(newFacts)` — append to observation log block
- `replaceObservationLog(summary)` — replace with compressed version
- `hierarchicalCompress(oldLog, newSummary)` — merge old + new → one block
- Prevents unbounded growth of the observation log itself

### F. Sliding Window Eviction

- Preserve all system messages unconditionally
- Evict oldest non-system messages first (whole messages, not truncated)
- Stop when total tokens < budget

## Integration Points in Supervisor

| Supervisor Component | Change |
|---------------------|--------|
| `src/memory/` | Add `WorkingMemory` class with 4-block layout |
| `src/core/contextBuilder.ts` | Build context in System→Core→ObsLog→Recent order |
| `src/core/compaction.ts` | New: multi-phase compaction with circuit breaker |
| State schema | Add `MemoryConfig` to project settings |
| Session state | Track `totalInputTokens`, `totalOutputTokens`, `totalCostUsd` |

## Acceptance Criteria

- [ ] Working memory has 4 named blocks with correct ordering
- [ ] Compaction triggers at configurable threshold (default 85%)
- [ ] Protection window prevents compressing last N tokens
- [ ] Circuit breaker prevents cascading failures in LLM summarization
- [ ] Token counting via tiktoken on every message add
- [ ] Observation log grows via hierarchical compression, not append-only
