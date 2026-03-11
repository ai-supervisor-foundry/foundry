# Usage

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

## 2. Set Goal

```bash
npm run cli -- set-goal \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --description "Your goal description here" \
  --project-id my-project
```

**Important**: The `--project-id` should match the directory name in `sandbox/` where your boilerplates are located.

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
