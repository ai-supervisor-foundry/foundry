# 004 - Implementation & Testing Steps

Purpose: execution checklist for applying prompt tightening and verifying behavior.

## Phase 1 - Rules Block
- Add buildRulesSection(sections, agentMode) helper with verbatim Rules block (see 001).
- Call after Acceptance Criteria in buildPrompt/buildFixPrompt/buildClarificationPrompt.
- Remove standalone agent-mode/ambiguity lines now covered by Rules.

## Phase 2 - Output Contract & Path Validation
- Replace Output Requirements with JSON-only block (see 002).
- Add validateFilePaths() utility; wire into controlLoop.ts after providerResult parsing for files_created/files_updated/changes.

## Phase 3 - Context & Guidelines
- Apply buildMinimalState selectivity and logging (see 003).
- Slim addTaskTypeGuidelines; add shared constraints only for code-modifying tasks.
- Tighten buildFixPrompt/buildClarificationPrompt instructions; remove repeated task/criteria sections.

## Phase 4 - Token Analysis (optional)
- Write scripts/analyze-prompt-tokens.ts to print prompt length/token estimate and included context per task type.
- Compare baseline vs optimized outputs; target 30-40% reduction.

## Testing Checklist
- Unit: promptBuilder (Rules position, single agent-mode line, JSON-only text present), buildMinimalState inclusion/omission cases, validateFilePaths filtering absolute/non-existent/traversal paths.
- Integration: ambiguous task → early-stop JSON failed status with clarification; hallucination-prone task → filtered paths; doc task → minimal context; fix prompt shorter without repeated task text.
- Regression: run regression task suite before/after; ensure success rate ≥ baseline and no JSON parse failures.

## Acceptance
- Agent responses are JSON-only (no prose), parseable.
- No hallucinated paths; filtered paths logged.
- Prompts hit token targets above.
- Rules block present once per prompt and covers all behavioral constraints.
