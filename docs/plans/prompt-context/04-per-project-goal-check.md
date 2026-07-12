# 04 — Per-Project Goal Completion Check

**Status:** Not started  
**Priority:** High  
**Review:** Incorporated 2026-06-13 ([REVIEW-INSIGHTS.md](../REVIEW-INSIGHTS.md))

**Merged from:**
- Base: `docs/plans/done/per-project-goals.md` (§ goalCompletionChecker — never fully implemented)
- Extract: `docs/plans/done/prompt-context/01-goal-completion-fix.md` (cwd + dynamic paths — partial stopgap)
- Backups: `tmp/plan-backups/2026-06-13/`

**Supersedes:** Monolithic sandbox-root goal check in `01-goal-completion-fix.md` (shipped stopgap until this lands).

---

## Problem

`state.goals` is per-project, but `GoalCompletionChecker` still runs **one** agent call for **all** goals from sandbox root with one session ID.

---

## Solution

| Aspect | Stopgap (current) | Target |
|--------|-------------------|--------|
| Scope | All goals, one prompt | One check per incomplete `project_id` |
| CWD | `sandboxRoot` | `sandbox/<projectId>` or active worktree |
| Session | `default` / first project key | `active_sessions['project:${projectId}']` |
| Tasks in prompt | All completed/blocked | Filter by `project_id` |
| Completion | Bulk mark all goals | Set `goals[pid].completed` individually |
| Supervisor COMPLETED | One boolean | `Object.values(goals).every(g => g.completed)` |

**Out of scope v1:** Cross-project meta goal key (`__all__`).

---

## Affected files

| File | Change |
|------|--------|
| `goalCompletionChecker.ts` | Per-project loop; set `goals[pid].completed`; return aggregated result |
| `promptBuilder.ts` | `buildGoalCompletionPrompt(state, projectId)` — drop unused `sandboxRoot` |
| `controlLoop/index.ts` | **Remove** bulk `goal.completed = true` loop (~171–173) |
| `scheduler/index.ts` | **Remove** bulk mark (~98–100); same checker behavior |
| `multi-project-goals.test.ts` | Queue **N** stub responses for **N** incomplete goals |
| `promptBuilder.test.ts` | Single-project prompt + parser tests |

---

## Implementation

### 0. Remove bulk marking (same PR)

Checker is sole writer of `state.goals[pid].completed`. Control loop / scheduler only react to `GoalCheckResult.completed`.

### 1. `resolveProjectCwd(projectId, state)`

```typescript
function resolveProjectCwd(projectId: string, state: SupervisorState, sandboxRoot: string): string {
  const active = state.active_tasks && Object.values(state.active_tasks).find(
    at => (at.task as Task).project_id === projectId && at.worktree_path
  );
  if (active?.worktree_path) return active.worktree_path;
  return path.join(sandboxRoot, projectId);
}
```

### 2. `goalCompletionChecker.ts`

- Respect `IS_ENABLED_GOAL_COMPLETION_CHECK === 'false'` (unchanged — skip all checks)
- Loop **all** incomplete goals (no short-circuit on first failure)
- Track `anyFailed` when parse returns `false`
- `shouldHalt: anyFailed` after all checks complete
- Session: `` `project:${projectId}` `` feature id (match `sessionResolver.ts`)
- Log: `appendPromptLog(sandboxRoot, projectId, { type: 'GOAL_COMPLETION_CHECK', ... })` — project id is the log path arg, not metadata

### 3. `buildGoalCompletionPrompt(state, projectId)`

- Singular copy: “this project's goal”
- One goal block; filter `completed_tasks` / `blocked_tasks` by `project_id`
- Include `task_id` + `intent` in completed list (not id-only)
- Project structure: `.` (agent cwd is project root)
- JSON output unchanged

### 4. `parseGoalCompletionResponse`

- Add unit tests for JSON + text fallback heuristics

---

## Acceptance criteria

- [ ] Each incomplete goal: own execute(), cwd, session, prompt log path
- [ ] One project completing does not mark others
- [ ] No bulk mark in control loop or scheduler
- [ ] Session key `project:${projectId}` aligned with sessionResolver
- [ ] Functional test: 2 goals → 2 agent responses → independent `goal.completed`
- [ ] Parser unit tests added

---

## Regression note

01 stopgap (sandbox-root cwd) is **replaced** by per-project cwd. Cross-repo visibility moves to explicit multi-project goals later, not monolithic check.
