# Usage

## Quick start (minimal)

From the project root (after [installation-setup](./installation-setup.md) and with DragonflyDB running):

```bash
# 1. Init state and set goal (once per project)
pnpm run cli -- init-state --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2 --execution-mode AUTO
pnpm run cli -- set-goal --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2 --project-id my-project --description "Your goal"

# 2. Enqueue tasks
pnpm run cli -- enqueue --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2 --task-file tasks/tasks.json

# 3. Start the control loop
pnpm run cli -- start --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2
```

Use `npm run cli --` if you use npm instead of pnpm. For PM2 (daemon), see [pm2-integration.md](./pm2-integration.md).

## Software Factory Workflow

The typical workflow follows this pattern:

1. **Prepare Code Boilerplates** (optional but recommended)
2. **Initialize Supervisor State**
3. **Set Goal**
4. **Enqueue Tasks**
5. **Start Supervisor** (autonomous execution)

## 0. Prepare Code Boilerplates (Optional)

Before starting the supervisor, you can prepare initial code in the sandbox directory:

```bash
# Create project directory
mkdir -p sandbox/my-project

# Copy boilerplate/starter code
cp -r my-boilerplate/* sandbox/my-project/

# Or initialize a new project structure
cd sandbox/my-project
npm init -y
# ... add initial files, dependencies, etc.
```

**What to include in boilerplates**:
- Project structure (directories, config files)
- Initial dependencies (`package.json`, `requirements.txt`, etc.)
- Starter templates (React components, API routes, etc.)
- Configuration files (`.env.example`, `tsconfig.json`, etc.)
- Existing codebase (if continuing work on an existing project)

The supervisor will **work with and build upon** this existing code. Tasks can reference existing files, extend functionality, or create new features.

## 1. Initialize Supervisor State

```bash
npm run cli -- init-state \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --execution-mode AUTO
```

## 2. Set Goals (per project)

Goals are per-project. Run once per project you want to work on:

```bash
npm run cli -- set-goal \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --project-id my-project \
  --description "Your goal description here"
```

Repeat with a different `--project-id` for each sandbox project. `--project-id` is required and must match the directory name under `sandbox/`.

## 3. Enqueue Tasks

```bash
npm run cli -- enqueue \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --task-file tasks/tasks.json
```

Tasks can reference existing files from your boilerplates. For example:
- "Extend the existing `App.tsx` component to add..."
- "Add a new API endpoint following the pattern in `routes/users.ts`"
- "Update the existing database schema in `schema.sql`"

### Parallel Execution Fields

Each task **must** include `affects_files` (required for file locking in parallel mode):

```json
{
  "task_id": "task-001",
  "project_id": "my-project",
  "affects_files": ["src/api/users.ts", "src/models/user.ts"],
  "depends_on": ["task-000"],
  ...
}
```

- `affects_files` (required): Files this task will modify. Used for file-level locking to prevent concurrent edits.
- `depends_on` (optional): Task IDs that must complete before this task can start. Tasks with unmet dependencies go to the waiting queue and are automatically promoted when deps complete.

## 4. Start Supervisor

```bash
npm run cli -- start \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

## 5. Monitor Execution

```bash
# Check status
npm run cli -- status \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2

# View audit logs
tail -f sandbox/<project-id>/audit.log.jsonl

# View PM2 logs
pm2 logs supervisor --nostream
```

## Halt/Resume

```bash
# Halt
npm run cli -- halt \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --reason "Operator intervention"

# Resume
npm run cli -- resume \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

## State Management

To dump the current state to a JSON file (for debugging or backup):

```bash
npm run tsx scripts/dump-state.ts -- \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --output STATE.json
```

To load state from a JSON file (overwriting Redis state):

```bash
npm run tsx scripts/load-state.ts -- \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --input STATE.json
```
