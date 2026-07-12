# 02 — Exact Doc Edits

**Status:** Not started  
**Depends on:** [01-overview.md](./01-overview.md)  
**Type:** Doc-only (no `src/` / `UI/` / test changes)

---

## File checklist

| # | File | Action |
|---|------|--------|
| 1 | `supervisor-contexts/sandbox-enforcement.md` | Rewrite Multi-Project Rules + Supervisor Enforcement |
| 2 | `docs/SANDBOX.md` | Same corrections (keep in sync with #1 or point to contexts) |
| 3 | `supervisor-contexts/task-schema.md` | Fix § Project Assignment `working_directory` CWD claim |
| 4 | `supervisor-contexts/sandbox-structure.md` | One-line CWD override note |
| 5 | `docs/plans/README.md` | Already indexed when this plan lands |

**Do not edit** (already correct): `state-management.md`, `queue-system.md`, `configuration.md`.

---

## 1. `supervisor-contexts/sandbox-enforcement.md`

### Multi-Project Rules — replace bullets

**Remove:**
- Has its own state key
- Has its own task queue

**Replace section with:**

```markdown
## Multi-Project Rules

Each app/project:
- Has its own directory (`sandbox/{project_id}/`)
- Has its own goal in shared state (`state.goals[project_id]`)
- Is selected per task via required `project_id` (drives agent CWD)

One supervisor instance uses **one** state key (`--state-key`) and **one** task queue
(`--queue-name`) for all projects. Isolation is filesystem + logical fields, not
separate Redis keys. See [state-management.md](./state-management.md) and
[queue-system.md](./queue-system.md).
```

### Supervisor Enforcement — replace “No shared state”

**Remove:** `**No shared state**`

**Replace with:**
```markdown
- **No cross-project file access** (agent `cwd` scoped to the task's project path)
- **Shared supervisor state** across projects (one Redis blob: goals map, completed/blocked, locks, sessions)
- **Per-project artifacts** under each sandbox dir (audit log, prompt logs, metrics)
- Agent process is spawned with `cwd` from `resolveTaskSandboxCwd`: worktree override → `working_directory` → `project_id`; `sandbox_root` is also injected into the state snapshot context
```

Keep Sandbox Location / Working with Existing Code / Violations unless they contradict the above. Sandbox Location already mentions `working_directory` — keep aligned with code.

---

## 2. `docs/SANDBOX.md`

Apply the **same** Multi-Project + Enforcement corrections as §1.

Optional cleanup (same PR if cheap):
- Drop or update the stale “Cursor task prompts must specify: `WORKING DIRECTORY: …`” line if prompts already inject cwd via snapshot — verify against `promptBuilder` / tool contracts before deleting; if still operator guidance, keep and note it is prompt convention, not Redis isolation.

Prefer keeping `docs/SANDBOX.md` as a short mirror of contexts, or add a one-liner: “Canonical: `supervisor-contexts/sandbox-enforcement.md`.”

---

## 3. `supervisor-contexts/task-schema.md` § Project Assignment

**Current (wrong):**
> The `working_directory` field is optional prompt-level context — if provided, its value is appended to the task prompt for additional path context but does **not** override the CWD (which is always derived from `project_id`).

**Replace with:**
```markdown
Each task must specify its `project_id`. Default agent CWD is `sandbox/{project_id}/`.
Optional `working_directory` (relative to `sandboxRoot`) **overrides** that default when set
(`resolveTaskSandboxCwd` in `taskExecutor.ts`). Parallel workers may further override via
worktree path. See [sandbox-enforcement.md](./sandbox-enforcement.md).
```

---

## 4. `supervisor-contexts/sandbox-structure.md` § Task-to-Project Assignment

After the CWD bullet, add:

```markdown
- Optional `task.working_directory` overrides the default CWD when set (relative to sandbox root).
```

Leave the FE/BE “subdirectory via instructions” bullet as-is (still valid when `working_directory` is unset).

---

## Suggested edit order

1. `sandbox-enforcement.md` (source of truth for isolation wording)
2. `docs/SANDBOX.md` (mirror)
3. `task-schema.md` (CWD contract)
4. `sandbox-structure.md` (one line)

Announce after each file (or after each ~6-line hunk) for operator review per project rules.

---

## Acceptance criteria

- [ ] No remaining claim that each project has its own Redis state key or task queue in `sandbox-enforcement.md` or `docs/SANDBOX.md`
- [ ] “No shared state” removed or replaced with shared-blob / isolated-cwd wording
- [ ] Cross-links to `state-management.md` and `queue-system.md` present
- [ ] `task-schema.md` matches `resolveTaskSandboxCwd` / `types.ts` on `working_directory`
- [ ] `sandbox-structure.md` mentions optional CWD override
- [ ] `state-management.md` / `queue-system.md` unchanged (still authoritative)
- [ ] No `src/` or test changes in the implementing PR

---

## Non-goals reminder

Do **not** implement per-project `--state-key` / `--queue-name` derivation in this PR. If an operator wants hard isolation today, document as ops pattern only (run separate supervisor processes with distinct CLI flags) — optional footnote in `sandbox-enforcement.md`, not a feature.
