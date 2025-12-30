# Supervisor Specifications

- The supervisor does not define goals.
- Operator must inject goals.
- Scope cannot be expanded by AI.
- All tasks require explicit acceptance criteria.
- No task runs without validation.
- No refactoring without explicit instruction.
- State must be persisted after every step.
- Ambiguity halts execution.
- Cursor CLI is a worker tool, not decision authority.
- AUTO MODE is default and mandatory.
- AUTO MODE cannot be disabled without operator instruction.
- No silent retries.
- All outputs are reviewable (diffs, logs).

## Anti-Goals (Do NOT Implement)

- Autonomous goal refinement
- Speculative task creation
- Retry heuristics
- AI-based validation
- "Helpful" corrections
- Fallback behaviors

If tempted → HALT.

---

## Cleanup Rules

1. Always ask me before cleaning up core logic components.

---

## PM2 Rules

1. PM2 logs check is always non-streamed, non-interactive.


## Project Context Files (`contexts/`)

1. Context files in `contexts/` provide detailed project documentation for agents with zero context.
2. Read relevant context file before working on a project (e.g., `contexts/easeclassifieds/frontend.md` for FE work).
3. Context files contain project structure, recent fixes, configuration, and common issues.
4. Update context files when making significant changes to keep them current.
5. Use context files to quickly onboard new agents or understand project state.

## Supervisor Context Files (`supervisor-contexts/`)

1. **Main Context**: Read `supervisor-contexts/CONTEXT.md` first for complete supervisor system documentation (architecture, state management, validation, tool contracts, etc.).
2. **Sliding Window**: Check `supervisor-contexts/windows/` for the 10 latest context files with recent changes, updates, and critical information.
3. **File Size**: Each window file targets 50K-100K tokens (30K-60K words) for very large context models.
4. **Usage**: Use supervisor context files when working on the supervisor system itself (not project tasks).
5. **Updates**: Window files are manually maintained by the operator—do not auto-generate them.
