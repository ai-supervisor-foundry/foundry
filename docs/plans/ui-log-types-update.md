# Proposal: Update Prompt Log Types in UI Frontend

## Problem
The `ChatVisualizer` component in the frontend uses a limited set of log types to distinguish between supervisor messages and agent responses. New log types have been introduced in the backend (e.g., `HELPER_AGENT_PROMPT`, `GOAL_COMPLETION_CHECK`), but the frontend logic doesn't explicitly account for them, potentially causing rendering issues or misclassification.

## Analysis
The `PromptLogType` in `src/promptLogger.ts` defines the following types:
- `PROMPT`
- `RESPONSE`
- `INTERROGATION_PROMPT`
- `INTERROGATION_RESPONSE`
- `FIX_PROMPT`
- `CLARIFICATION_PROMPT`
- `HELPER_AGENT_PROMPT`
- `HELPER_AGENT_RESPONSE`
- `GOAL_COMPLETION_CHECK`
- `GOAL_COMPLETION_RESPONSE`

Currently, `UI/frontend/src/components/ChatVisualizer.tsx` likely has logic like:
```typescript
const isSupervisor = ['PROMPT', 'INTERROGATION_PROMPT', ...].includes(type);
const isAgent = ['RESPONSE', 'INTERROGATION_RESPONSE', ...].includes(type);
```
Or it might be defaulting unknown types.

## Proposed Changes

1.  **Update `UI/frontend/src/components/ChatVisualizer.tsx`**:
    *   Expand the `isSupervisor` (or equivalent) logic to include:
        *   `HELPER_AGENT_PROMPT`
        *   `GOAL_COMPLETION_CHECK`
        *   `FIX_PROMPT`
        *   `CLARIFICATION_PROMPT`
    *   Expand the `isAgent` (or equivalent) logic to include:
        *   `HELPER_AGENT_RESPONSE`
        *   `GOAL_COMPLETION_RESPONSE`
    *   Update any type definitions or interfaces that restrict the `type` string.

2.  **Update `UI/frontend/src/components/LogViewer.tsx`** (Optional):
    *   Ensure it can gracefully display these new string types if it uses any specific formatting or icons based on type.

## Goal
Ensure all distinct phases of the Supervisor's control loop (Execution, Validation/Helper, Interrogation, Goal Check) are correctly visualized as a conversation between "Supervisor" and "Agent".
