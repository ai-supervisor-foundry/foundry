# 01 — Operator Takeover: Overview

## Problem

Today, the operator controls the supervisor through CLI commands or read-only UI. There's no way to **interactively intervene** mid-task — e.g., to guide an agent, provide clarification, or pivot the approach. The only option is **HALT** (kills everything).

## Concept

**Takeover** = operator presses "Take Over" button on a running task in the dashboard:

1. **Kill the running task immediately** (send `SIGTERM` to child process)
2. **Stop the control loop temporarily** (set status to `TAKEOVER`)
3. **Open interactive chat panel** in the UI (Claude Code-like experience)
4. **Operator provides new instructions/guidance** via chat
5. **Operator decides next action**:
   - Resume from this point with updated instructions
   - Rerun the entire task with new goal
   - Mark as complete/blocked

## State Flow

```
RUNNING --[Take Over]--> TAKEOVER --[Resume]--> RUNNING
                              |--[Complete]--> COMPLETED
                              |--[Abort]--> BLOCKED
```

New supervisor status: `TAKEOVER`

Active task metadata:

```json
{
  "task_id": "fix-login-bug",
  "status": "TAKEOVER",
  "takeover": {
    "initiated_at": "ISO",
    "killed_at": "ISO",
    "execution_logs": "...", // what the agent did before kill
    "operator_id": "session-xxx",
    "messages": [
      { "role": "operator", "content": "Try a different approach", "timestamp": "ISO" },
      { "role": "system", "content": "Task resumed with new instructions", "timestamp": "ISO" }
    ]
  }
}
```

## UX Flow

1. Dashboard shows task cards with "Take Over" button (only for `RUNNING` tasks)
2. Clicking "Take Over":
   - Shows confirmation: "This will kill the running process. Continue?"
   - On confirm: process is killed immediately
   - Panel opens with task context + execution logs
   - Status shows "TAKEOVER — Process killed, waiting for instructions"
3. Operator types message, sends it
4. Bottom action buttons: **Resume**, **Rerun**, **Complete**, **Abort**

```
┌──────────────────────────────────────────────────────┐
│  Take Over: fix-login-bug                 [← Back]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  TASK CONTEXT                                        │
│  Intent: Fix login form email validation            │
│  Project: easeclassifieds                            │
│  Acceptance: ✓ Validate email format                │
│              ✓ Show error on invalid input          │
│                                                      │
│  EXECUTION LOG (before kill)                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │ > Analyzing src/components/LoginForm.tsx         │ │
│  │ Found email validation: /^.+@.+\..+$/            │ │
│  │ Issue: Doesn't handle '+' in local part         │ │
│  │ Creating fix...                                  │ │
│  │ Killed: SIGTERM received                        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ OPERATOR ────────────────────────────────────┐  │
│  │ Actually, the issue is the regex doesn't       │  │
│  │ allow '+' in the local part. Here's the fix:   │  │
│  │ /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\...        │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  [Input: Type instructions...]      [Send Message]  │
│                                                      │
│  [Resume ▶]  [Rerun ↻]  [Complete ✓]  [Abort ✕]    │
└──────────────────────────────────────────────────────┘
```

## Actions on Takeover

| Action | Behavior | Result |
|--------|----------|--------|
| **Resume** | Resumes control loop with same task, same execution context. Appends operator message to task instructions. | Task continues from where it left off (with updated goal) |
| **Rerun** | Kills the current execution, resets task to `pending`, re-enqueues with operator's message as new instructions | Task re-executes from scratch |
| **Complete** | Marks task as `COMPLETED` immediately, with operator notes | Task marked done manually |
| **Abort** | Marks task as `BLOCKED` with operator notes | Task requires manual fix before resume |

## Scope: Single-Control-Loop Focus

**Initial scope**: Works with the **single-task control loop** (not parallel scheduler).

**Why**: With parallel workers, the UI would need to show "which worker?" — operator selects a specific worker/task to takeover. This adds complexity:
- UI: worker selection, resource display per worker
- Backend: per-worker suspension management
- Testing: multi-worker scenarios

**Future consideration**: Extend to parallel scheduler with a "Select Worker" dialog.

## Constraints

- Takeover is **synchronous** — control loop halts until operator completes takeover
- Only **one active takeover** per task
- Takeover requires **active execution** (task must be in `active_tasks`)
- Operator messages are **appended to task context** — provider sees full conversation history
