# Per-Project Goals

**Status:** COMPLETED
**Date:** 2026-03-12
**Depends on:** multi-goal-support.md (Option B — completed)

---

## Problem

After Option B (required `task.project_id`), the supervisor still has a single `state.goal` object. With tasks assigned to multiple projects, a single goal doesn't map well — each project needs its own goal description, completion status, and completion check.

## Solution

Replace `state.goal` (single object) with `state.goals` (Record keyed by project_id).

### State Shape

```typescript
// Before
goal: { description: string; completed: boolean; project_id?: string; }

// After
goals: Record<string, Goal>;  // keyed by project_id

interface Goal {
  description: string;
  completed: boolean;
  project_id: string;  // same as the key, for self-reference
}
```

### Key Behaviors

- `set-goal --project-id X --description "..."` — upserts goal for project X (project_id now required)
- Supervisor status = COMPLETED only when **all** project goals are completed
- Goal completion checker runs per-project (filters tasks by project_id)
- Dashboard shows goals table: Project | Goal | Status | Actions
- `state.goal` removed entirely — no backward compat shim

---

## Affected Files

### Core Types
| File | Change |
|------|--------|
| `src/domain/types/types.ts` | `goal` → `goals: Record<string, Goal>`; add `Goal` interface |

### CLI (`src/application/entrypoint/cli.ts`)
| Location | Change |
|----------|--------|
| `init-state` | Create empty `goals: {}` instead of single goal object |
| `set-goal` | Require `--project-id`; upsert into `state.goals[projectId]` |
| `status` | List all goals with per-project status |
| `resume` / `start` | Validate at least one goal exists; resolve project from context |
| `showMetrics` (L476) | Iterate goals, not single goal |

### Control Loop (`src/application/services/controlLoop/`)
| File | Change |
|------|--------|
| `index.ts` L159 | `state.goals[task.project_id].completed = true` (per-project) |
| `index.ts` | Overall COMPLETED = `Object.values(state.goals).every(g => g.completed)` |
| `modules/goalCompletionChecker.ts` | Accept project_id param; check goal for that project only |

### Prompt & Session
| File | Change |
|------|--------|
| `promptBuilder.ts` L87,128,129,693,788 | Read from `state.goals[task.project_id]` with fallback |
| `modules/sessionResolver.ts` L50 | Goal lookup via `state.goals[task.project_id]` |

### Recovery & Persistence
| File | Change |
|------|--------|
| `domain/executors/recovery.ts` L113,120 | Check `goals` map instead of single `goal.completed` |
| `application/services/persistence.ts` L82 | Log goals map on load |
| `infrastructure/adapters/logging/auditLogger.ts` L53 | Capture goals diff |

### UI Backend
| File | Change |
|------|--------|
| `UI/backend/src/services/supervisorState.ts` | Update `SupervisorState` interface: `goals: Record<string, Goal>` |

### UI Frontend
| File | Change |
|------|--------|
| `Dashboard.tsx` | Replace single goal card with goals table; add/edit goal per project |
| `api.ts` | `setGoal(projectId, description)` — project_id required |

### Tests (all need `state.goal` → `state.goals`)
| File | Approximate Fixes |
|------|-------------------|
| `tests/helpers/state-builders.ts` | Builder creates `goals` map; `withGoal(desc, projectId)` upserts |
| `tests/unit/domain/types.test.ts` | ~4 state literals |
| `tests/unit/integration.test.ts` | ~3 goal references |
| `tests/unit/application/persistence.test.ts` | ~2 goal references |
| `tests/functional/scenarios/control-loop/happy-path.test.ts` | 1 goal check |

### Scripts
| File | Change |
|------|--------|
| `scripts/clean-goal.ts` | Iterate `state.goals` entries |
| `scripts/check-goal.ts` | Print all goals |

### Documentation
| File | Change |
|------|--------|
| `supervisor-contexts/state-management.md` | Update state schema, goal resolution section |
| `TASK_SCHEMA.json` | No change (tasks already have project_id) |

---

## Migration

Existing state with `state.goal` needs one-time migration:

```typescript
// On state load, if old shape detected:
if (state.goal && !state.goals) {
  const projectId = state.goal.project_id || 'default';
  state.goals = {
    [projectId]: {
      description: state.goal.description,
      completed: state.goal.completed,
      project_id: projectId,
    }
  };
  delete state.goal;
}
```

This runs in `persistence.ts` on load. After first save, old shape is gone.

---

## Implementation Order

1. Types + migration logic in persistence
2. CLI commands (set-goal, init-state, status)
3. Control loop + goal completion checker
4. Prompt builder + session resolver + recovery
5. Audit logger
6. UI backend interface
7. UI frontend (Dashboard goals table)
8. Tests
9. Scripts + docs
