---
description: Validation pipeline — deterministic, helper agent, interrogation, scoring
---

# Validation

## Rules

- Validation must be **deterministic, rule-based, and non-AI**
- Examples: file exists, tests pass, diff matches criteria, artifact count matches
- If validation cannot be automated → HALT + operator clarification

## Pipeline

1. **Standard Validator**: Keyword/AST heuristic matching against code content
2. **Deterministic Validator**: File existence, test commands, artifact checks
3. **Helper Agent** (optional): Secondary adapter generates read-only validation commands
4. **Interrogation** (if Helper fails): Sequential Q&A with agent (max 4 rounds), batched criteria

## Scoring

- `MatchQuality` per criterion: `EXACT` > `HIGH` > `MEDIUM` > `LOW` > `NONE`
- Overall `confidence`: derived from lowest match quality
- `UNCERTAIN`/`LOW` confidence → triggers interrogation even if regex "passed"

## Result

- `confidence: 'HIGH' | 'LOW' | 'UNCERTAIN'`
- `HIGH` → task complete. `LOW`/`UNCERTAIN` → retry with fix prompt
- **Smart Retry**: Same error twice → switches to "Strict Mode" prompt

## Prompt Construction

- Smart Context Injection: only includes goal/queue/completed context when relevant
- Strict output format (JSON only), path validation against filesystem
- Task-type guidelines auto-injected (implementation, config, testing, docs, refactoring)
