# Implementation Fixes & As-Built Report
Date: 2026-01-07

This document outlines deviations, corrections, and enhancements made during the implementation of the Prompt Tightening plan, contrasting the original plan documents (001-004) with the actual codebase state.

## 1. Architecture Correction: Validation Location
- **Plan (`002-output-and-paths.md`)**: Proposed wiring `validateFilePaths` into `controlLoop.ts` immediately after `providerResult` parsing.
- **Implementation**: 
  - `controlLoop.ts` does not handle JSON parsing or response interpretation (it handles raw provider output).
  - **Parsing and Sanitization** logic resides in `src/application/services/validator.ts` (`validateTaskOutput` function).
  - `validateFilePaths` was integrated into `validator.ts` (via `validateTaskOutput`), ensuring all file paths are sanitized before any validation rules run.
- **Status**: Implemented in `validator.ts` instead of `controlLoop.ts`. Safer and more cohesive.

## 2. Context Enhancement: Recency Bias
- **Plan (`003-context-and-guidelines.md`)**: Proposed "Context Selectivity" relying strictly on keywords (`extend`, `previous`) to include `completed_tasks`.
- **Implementation**: 
  - Identified a risk of context loss for implicitly related tasks.
  - **Added "Recency Bias"**: `buildMinimalState` now *always* includes the single most recent completed task (last 1) in the context, regardless of keywords.
  - Keyword-based logic still triggers the inclusion of a larger history (last 5).
- **Status**: Enhanced logic implemented in `promptBuilder.ts`.

## 3. Feedback Loop Enhancement: Content Snippets
- **Plan (`003-context-and-guidelines.md`)**: Discussed tightening `buildFixPrompt`.
- **Implementation**: 
  - Added logic to `buildFixPrompt` to **read and inject content snippets** (first 50 lines) of files referenced in validation errors.
  - This prevents the agent from "flying blind" when a content check (e.g., `grep_found`) fails, allowing it to see the current state of the file it needs to fix.
- **Status**: Enhanced logic implemented in `promptBuilder.ts`.

## 4. Code Structure: Unified Rules
- **Plan (`001-rules-block.md`)**: Requested a consolidated rules block.
- **Implementation**: 
  - Created `const RULES_BLOCK` in `promptBuilder.ts`.
  - Used this constant in `buildPrompt`, `buildFixPrompt`, and `buildClarificationPrompt` to ensure 100% consistency across all interaction modes.
  - Added explicit instruction to "Check READ-ONLY CONTEXT first" before asking clarifying questions.
- **Status**: Implemented.

## 5. Defensive Parsing
- **Plan (`002-output-and-paths.md`)**: Requirement for JSON-only output.
- **Implementation**:
  - `validator.ts` utilizes `findJSONInString` to regex-extract JSON blocks from potential Markdown wrappers (` ```json ... ``` `), satisfying the defensive parsing requirement.
- **Status**: Verified in `validator.ts`.
