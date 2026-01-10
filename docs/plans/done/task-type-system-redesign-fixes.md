# Task Type System Redesign - Post-Implementation Analysis

**Status:** Completed
**Date:** 2026-01-09

## 1. Overview
The migration to the Strategy Pattern for `PromptBuilder` was successful and enabled `behavioral` and `verification` tasks. However, a review of the code changes revealed a minor regression in the specificity of guidelines for certain coding sub-tasks.

## 2. Identified Regressions

### 2.1 Loss of Task-Specific Guidelines
In the previous implementation, `addTaskTypeGuidelines` injected specific advice for `testing`, `configuration`, `documentation`, and `refactoring` tasks. These have been consolidated into the generic `CODING_STRATEGY`.

**Lost Guidelines:**
- **Testing:** "Descriptive assertions for edge cases"
- **Configuration:** "Verify file locations; use fallback values"
- **Documentation:** "Clear formatting; validate all links"
- **Refactoring:** "Improve structure without changing behavior"

**Current State:**
All the above task types now receive the generic `CODING_STRATEGY` guidelines:
- "Ensure all exports/imports are typed"
- "No conversational filler; code changes + JSON only"
- "Follow established project patterns"

## 3. Impact Assessment
- **Severity:** Low to Medium.
- **Risk:** Agents performing testing or refactoring tasks might be slightly less effective without the specific "Descriptive assertions" or "Improve structure" reminders.
- **Benefit:** The codebase is significantly cleaner and uses a consistent Strategy Pattern.

## 4. Proposed Fix
We should re-introduce these specific strategies by creating variations of the `CODING_STRATEGY`.

### Plan
1.  Define `TESTING_STRATEGY`, `REFACTORING_STRATEGY`, etc.
2.  These strategies should reuse `CODING_STRATEGY.getRules` and `CODING_STRATEGY.getOutputRequirements`.
3.  They should override `getGuidelines` to include both the generic coding guidelines AND the specific lost guidelines.

### Example (Conceptual)
```typescript
const TESTING_STRATEGY = {
  ...CODING_STRATEGY,
  getGuidelines: () => [
    ...CODING_STRATEGY.getGuidelines(),
    '- Descriptive assertions for edge cases'
  ]
};
```

## 5. Action Items
- [x] Create `docs/plans/restore-specific-strategies.md` to track this work. (Skipped, implemented directly)
- [x] Implement specific strategies in `src/domain/agents/promptBuilder.ts`.
