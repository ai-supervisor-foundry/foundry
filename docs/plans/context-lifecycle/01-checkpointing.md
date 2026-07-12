# 01 — Provider Checkpointing

**Status:** Stub — needs full spec  
**Priority:** High  
**Blocks:** [02-context-window-handoff.md](./02-context-window-handoff.md)

## Goal

Checkpointing for all providers — unified hook to persist/resume execution state when context limits approach or provider switches.

## Open Questions (before implementation)

1. Checkpoint storage location: `state.active_sessions` extension vs sandbox markdown files?
2. Provider-specific session ID handling (Cursor resume vs Claude vs Gemini)
3. Integration point: `sessionResolver.ts` (token limit) vs dedicated checkpoint service

## Next Step

Flesh out spec using patterns from [02-context-window-handoff.md](./02-context-window-handoff.md) (90/95/98% tiers).
