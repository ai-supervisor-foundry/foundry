# 01 — Overview: Sandbox Isolation Doc Drift

**Status:** Not started  
**Priority:** Low (docs accuracy; blocks agent/operator misunderstanding)  
**Type:** Doc-only

---

## Problem

`supervisor-contexts/sandbox-enforcement.md` and `docs/SANDBOX.md` claim each project has:

- its own **state key**
- its own **task queue**
- **no shared state**

That is **false** for the current codebase. One supervisor instance uses one `--state-key` and one `--queue-name`. Multi-project support is:

- filesystem: `sandbox/{project_id}/`
- logical: `state.goals[project_id]` + required `task.project_id`

A second drift: `task-schema.md` says `working_directory` is prompt-only and does **not** override CWD. Code (`resolveTaskSandboxCwd`) and `types.ts` say it **does** override.

---

## Code truth (verified)

| Concern | Actual behavior | Evidence |
|---------|-----------------|----------|
| State key | Single operator key (default `supervisor:state`) | `cli.ts` `--state-key`; `persistence.ts` single GET/SET |
| Queue | Single name → `queue:{name}` (+ `:ready`/`:waiting`) | `taskQueue.ts` `getQueueKey(queueName)` — no `project_id` |
| Goals | Map keyed by `project_id` inside shared blob | `state-management.md`; `SupervisorState.goals` |
| Tasks | Carry `project_id`; mixed in one FIFO queue | Task schema; enqueue paths |
| CWD | `sandboxRoot/project_id`, else `working_directory`, else worktree override | `taskExecutor.ts` `resolveTaskSandboxCwd` |
| Backup | `{sandboxRoot}/state.json` (not per-project) | `persistence.ts` |
| UI queue | One `config.supervisor.queueName` | `UI/backend/.../queueService.ts` |

No code paths derive Redis keys from `project_id` (grep: empty).

---

## Likely origin

Pre–per-project-goals docs assumed stronger isolation (or separate supervisor processes per app). After `state.goals` landed, filesystem + goal isolation was real, but Redis key/queue wording was never updated. Duplicate copy lives in `docs/SANDBOX.md`.

---

## Target wording (intent)

Each project:

- Has its own **sandbox directory** (`sandbox/{project_id}/`)
- Has its own **goal** in shared state (`state.goals[project_id]`)
- Declares **`project_id`** on every task (drives CWD + goal association)

Supervisor instance:

- Uses **one** state key and **one** task queue for all projects
- Isolates **files** per project (agent cwd); **shares** supervisor state (goals map, completed/blocked, locks, sessions)

Replace “No shared state” with precise bullets (no cross-project file access; shared Redis blob; per-project artifacts under each sandbox dir).

---

## Out of scope

| Item | Why |
|------|-----|
| Per-project Redis state keys / queues | Architectural redesign; conflicts with single control loop, shared completed/blocked, cross-project `depends_on` |
| Separate supervisor process per project | Operator ops pattern (manual `--state-key` / `--queue-name`); document as optional note only if useful — not a code feature |
| Implementing `04-per-project-goal-check` | Separate plan; do not conflate |
| Enforcing “no cross-project file access” in the agent | Prompt/cwd convention today; OS-level sandbox is not this plan |

---

## Decision

**Doc-only fix.** Do not change runtime. If product later wants hard multi-tenant Redis isolation, open a new architecture plan — do not silently expand this one.
