# Main overview (This project):
# Supervisor

A **persistent orchestration layer for AI-assisted software development** that enables long-running, restart-safe project execution with full operator control and auditability.

## What This Is

The Supervisor is a control plane for AI development that externalizes memory, intent, and control so work can continue across interruptions, sleep, crashes, or session loss. You define a goal and break it into explicit tasks with acceptance criteria. The supervisor executes tasks autonomously via your configured provider/agent CLI (e.g., Gemini, Copilot, Cursor) in AUTO mode while maintaining persistent state, deterministic validation, and full auditability.

**Workflow**:
```
Operator provides:
  ├─ Code Boilerplates (in sandbox/<project-id>/)
  ├─ Tasks (via enqueue command)
  └─ Goal (via set-goal command)
         ↓
Supervisor autonomously:
  ├─ Executes tasks in order
  ├─ Works with existing code
  ├─ Validates outputs
  ├─ Persists state
  └─ Continues until goal met or halted
```

This enables a **"set it and forget it"** workflow where you provide the foundation (boilerplates), the plan (tasks), and the destination (goal), then the supervisor builds the project autonomously.

## The Problem It Solves

AI coding agents are powerful but ephemeral—context is lost on interruption, making long-running projects difficult. The Supervisor provides:
- **Persistence**: State survives crashes, restarts, and interruptions
- **Deterministic Control**: No surprises—explicit validation, clear halt conditions
- **Long-Running Projects**: Work on complex projects over days or weeks
- **Full Auditability**: Every action is logged and reviewable
- **Cost-Effective**: Uses free tier tools (provider CLIs, DragonflyDB)

## How It Works

The supervisor operates as a **strict control mechanism** that executes operator-defined tasks through a fixed control loop. It maintains persistent state in DragonflyDB (Redis-compatible), manages a FIFO task queue, dispatches tasks to your chosen provider CLI with injected state context, and validates outputs deterministically. The system enforces sandbox isolation per project, provides append-only audit logging, and supports recovery from crashes or restarts by reloading persisted state. The supervisor never invents goals, expands scope, or makes autonomous decisions—all authority remains with the operator who injects goals and tasks explicitly.

## Overview

The supervisor is a **control mechanism** that:
- Holds externally injected goals
- Maintains persistent state
- Executes a fixed control loop
- Delegates tasks to provider/agent CLIs
- Validates results
- Retries on validation failures and ambiguity (up to max retries)
- Halts only on critical failures (execution errors, blocked status)

It does **not**:
- Invent goals
- Act independently
- Replace the operator
- Make autonomous decisions

## Supervisor Specifications

- The supervisor does not define goals.
- Operator must inject goals.
- Scope cannot be expanded by AI.
- All tasks require explicit acceptance criteria.
- No task runs without validation.
- No refactoring without explicit instruction.
- State must be persisted after every step.
- Ambiguity halts execution.
- Provider CLIs are worker tools, not decision authority.
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

## Always-Apply Behavioral Rules

0. Be concise with your ending responses unless asked for elaboration.
1. Propose means suggest without edits.
2. Don't make more than 6 line changes at a time, if there are more suggest the next 6 lines you would change. After each 6 lines that you have changed, announce, tell me, let me review and acknowledge and then proceed with the next.
4. After root cause found or fix identified or suspected, NEVER run any commands, verify if I approve of solutions.
5. Always check if you have MCP available before asking me.
6. Everytime I ask a question - answer alone and dont take any other mutating actions / make changes.
7. Even if you realize you made a mistake. Alert, inform me and halt, dont make changes.

---

## Cleanup Rules

1. Always ask me before cleaning up core logic components.
2. Always ask me before cleaning up or deleting anything.
3. Use ./tmp for *.baks always.

---

## PM2 Rules

1. PM2 logs check is always non-streamed, non-interactive.

2. Supervisor PM2 Management:
   - Supervisor runs via `npm run cli -- start` (uses tsx to run TypeScript directly, NOT a compiled binary)
   - Start: `pm2 start ecosystem.config.js` (NOT `pm2 start dist/index.js`)
   - Stop: First `npm run cli -- halt`, then `pm2 stop supervisor`, then `pm2 delete supervisor`
   - Restart: `pm2 restart supervisor` (after halt if needed)
   - The supervisor script is defined in ecosystem.config.js and uses npm/tsx, not a compiled dist file

3. On ANY error when starting/stopping supervisor, immediately halt and stop:
   - `npm run cli -- halt --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2`
   - `pm2 stop supervisor`
   - `pm2 delete supervisor`

---

## MCP Rules

1. If I ask to use an MCP and a tool fails report and shut up. Dont proceed.

---

## Secrets Rules

1. NEVER print any secret or credentials.
2. Always if you have to check, do a shell based length check.

---

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


## Supervisor
1. Supervisor when updated and has to be restarted should follow lifecycle: Halt, stop. Rebuild. Restart. Resume.

## Tasks Specs
1. Blocked tasks will never be autocompleted, They will always be set to pending and let the supervisor decide.

# Conditional Contexts
- ONLY When detailed info regarding project is required:
    - README.md - YES
    - ./docs/*.md - YES
    - !./docs/plans - NO

- ONLY When detailed info regarding what supervisor context is
    - ./supervisor-contexts

- ONLY When detailed info regarding what projects supervisor is working on and what we are doing in there is required:
    - ./contexts/sandbox/
