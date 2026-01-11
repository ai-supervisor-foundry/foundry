# Issue
 For some reason while testing, some new tasks were creatinga  default dir in sandbox.

# REASON
Ran terminal command: ls -la sandbox/

Ran terminal command: redis-cli -h localhost -p 6499 -n 2 LRANGE tasks 0 -1 | jq -r 'select(.project_id != null) | .project_id' 2>/dev/null | sort -u

Searched for regex `project_id.*default|sandboxPath.*default|"default"` (`**/src/**/*.ts`), 13 results

Found it! Multiple places use `state.goal.project_id || 'default'` as fallback. Let me check what the current goal's project_id is: 

Ran terminal command: redis-cli -h localhost -p 6499 -n 0 GET supervisor:state | jq -r '.goal.project_id'

**There it is!** Your goal has `project_id: null`, so all the code falls back to `'default'`. 

The logic is:
- `state.goal.project_id || 'default'` → when project_id is null/undefined, uses "default"
- This happens in taskExecutor, promptBuilder, controlLoop, goalCompletionChecker, etc.

You need to set a project_id when creating the goal. Check how you set the goal: 

Ran terminal command: redis-cli -h localhost -p 6499 -n 0 GET supervisor:state | jq '.goal'

The goal doesn't have a `project_id` field at all. When you set the goal, you need to include `--project-id` option:

```bash
npm run cli -- set-goal --goal "Your goal" --project-id "easeclassifieds"
```

Without it, everything defaults to default.

# SOLUTION - NOW

Let me check if tasks already have project_id support: 

Searched for text `interface Task` (`**/src/domain/types/types.ts`), 2 results

Read [](file:///home/ahmedhaider/work/projects/auto-layer/supervisor/src/domain/types/types.ts#86-86), lines 86 to 110

Tasks already support `working_directory` which overrides project_id! But let me check if tasks have a direct `project_id` field: 

Searched for text `project_id` (`**/src/domain/types/types.ts`), 3 results

Read [](file:///home/ahmedhaider/work/projects/auto-layer/supervisor/src/domain/types/types.ts#55-55), lines 55 to 75

So currently:
- **Goal has `project_id`** (optional)
- **Tasks have `working_directory`** (overrides project_id-based default)
- Tasks do NOT have a direct `project_id` field

**Options:**

**Option A (Minimal - UI only):** - REJECTED
- Keep single goal, make `project_id` optional/nullable
- Tasks use `working_directory` field (already exists) → UI needs to show this field
- When no goal.project_id set, tasks MUST specify working_directory
- No backend changes needed

**Option B (Better - small backend + UI):** - SELECTED
- Add `project_id` field to Task interface
- Use `task.project_id || state.goal.project_id || 'default'` in taskExecutor
- UI adds project_id dropdown/input to task creation form
- Goal's project_id becomes optional (for default project)


# SOLUTION - LATER

**Option C (Complex - multiple goals):**
- Extend state schema to support multiple goals
- Add active_goal_id to switch between them
- Requires significant state schema changes

I'd recommend **Option B** - it's cleaner than working_directory, lets you work on multiple projects, and only needs small changes.