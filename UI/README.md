# Supervisor UI

A standalone web application for monitoring and controlling the supervisor system. The UI runs completely isolated from the supervisor and does not affect its operation.

## Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Communication**: HTTP polling (2-second intervals, configurable)
- **Data Sources**: DragonflyDB (state), File System (logs)

## Directory Structure

```
UI/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API client
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/           # Node.js Express server
│   ├── src/
│   │   ├── routes/    # API routes
│   │   ├── services/  # Business logic
│   │   ├── server.ts
│   │   └── config.ts
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Setup

### Prerequisites

- Node.js >= 18.0.0
- Supervisor system running with DragonflyDB
- Supervisor CLI available in PATH

### Backend Setup

1. Navigate to backend directory:
```bash
cd UI/backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (optional, defaults provided):
```bash
export REDIS_HOST=localhost
export REDIS_PORT=6499
export STATE_KEY=supervisor:state
export QUEUE_NAME=tasks
export QUEUE_DB=2
export STATE_DB=0
export SANDBOX_ROOT=./sandbox
export PORT=3001
export POLL_INTERVAL=60000
```

4. Start development server:
```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd UI/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (optional):
   - Copy `.env.example` to `.env.local` and modify as needed
   - Or set environment variables directly
   - Vite automatically loads `.env.local` files
   - Variables must be prefixed with `VITE_` to be exposed to client code

4. Start development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or Vite default port)

## Development Workflow

### Running Both Servers

**Terminal 1 - Backend:**
```bash
cd UI/backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd UI/frontend
npm run dev
```

The frontend dev server is configured to proxy API requests to the backend.

### Building for Production

1. Build frontend:
```bash
cd UI/frontend
npm run build
```

2. Build backend:
```bash
cd UI/backend
npm run build
```

3. Run production server:
```bash
cd UI/backend
NODE_ENV=production npm start
```

The backend will serve the frontend static files and handle API requests.

## Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | DragonflyDB host |
| `REDIS_PORT` | `6499` | DragonflyDB port |
| `STATE_KEY` | `supervisor:state` | Supervisor state key in Redis |
| `QUEUE_NAME` | `tasks` | Task queue name |
| `QUEUE_DB` | `2` | Queue database index |
| `STATE_DB` | `0` | State database index |
| `SANDBOX_ROOT` | `./sandbox` | Sandbox root directory |
| `PORT` | `3001` | Backend server port |
| `POLL_INTERVAL` | `60000` | Polling interval in milliseconds |

### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API URL |
| `VITE_POLL_INTERVAL` | `60000` | Polling interval in milliseconds |

**Note**: Vite automatically loads `.env.local` files. Variables must be prefixed with `VITE_` to be exposed to client code via `import.meta.env`. The `.env.local` file is gitignored and should be used for local overrides.

## Features

### Dashboard
- Supervisor status (RUNNING/HALTED/BLOCKED/COMPLETED)
- Current iteration
- Goal description and completion status
- Queue status and length
- Quick stats (completed tasks, blocked tasks)
- Auto-refresh with manual refresh option

### Tasks View
- Current task display
- Queue contents (pending tasks)
- Completed tasks list
- Blocked tasks list
- Task detail modals
- Auto-refresh support

### Logs View
- Audit log timeline
- Prompt log list
- Project selector
- Filtering by task ID and type
- Full content viewer modals
- Configurable limit

### Command Executor
- **Supervisor Commands Tab**:
  - Execute supervisor CLI commands (init-state, set-goal, enqueue, halt, resume, status, start)
  - Command options (JSON format)
  - Output display
- **Shell Commands Tab**:
  - Execute shell commands with safety restrictions
  - Working directory selection
  - Command history
  - Output display

### State Inspector
- Raw JSON viewer
- Expandable/collapsible tree view
- Search functionality
- Copy to clipboard
- Auto-refresh support

## API Endpoints

### State
- `GET /api/state` - Get current supervisor state
- `GET /api/state/status` - Get supervisor status only
- `GET /api/state/current-task` - Get current task

### Tasks
- `GET /api/tasks/completed` - Get completed tasks
- `GET /api/tasks/blocked` - Get blocked tasks
- `GET /api/tasks/queue` - Get queue status and pending tasks

### Logs
- `GET /api/logs/projects` - Get available projects
- `GET /api/logs/audit?projectId=<id>&limit=<n>` - Get audit log entries
- `GET /api/logs/prompts?projectId=<id>&limit=<n>` - Get prompt log entries
- `GET /api/logs/audit/:taskId?projectId=<id>` - Get audit logs for specific task
- `GET /api/logs/prompts/:taskId?projectId=<id>` - Get prompt logs for specific task

### Commands
- `POST /api/commands/supervisor` - Execute supervisor CLI command
- `POST /api/commands/shell` - Execute shell command
- `GET /api/commands/history` - Get command execution history

### Config
- `GET /api/config` - Get UI configuration
- `POST /api/config` - Update UI configuration

## Security Notes

- **No Authentication**: The UI has no authentication (as per requirements). Use only in trusted environments.
- **Command Execution Safety**:
  - Supervisor CLI commands are validated against an allowlist
  - Shell commands are restricted to prevent dangerous operations
  - Working directory restrictions apply
  - Timeout protection (30s for shell, 60s for supervisor commands)
  - Output size limits (1MB for shell commands)

## Troubleshooting

### Backend won't start
- Check if DragonflyDB is running
- Verify Redis connection settings
- Check if port 3001 is available

### Frontend can't connect to backend
- Verify backend is running on correct port
- Check `VITE_API_URL` environment variable
- Check browser console for CORS errors

### No data displayed
- Verify supervisor state exists in DragonflyDB
- Check if projects exist in sandbox directory
- Verify log files exist for selected project

### Command execution fails
- Check if supervisor CLI is in PATH
- Verify command options are valid JSON
- Check command history for error details

## Development Notes

- The UI uses polling (not WebSocket/SSE) for real-time updates
- Polling interval is configurable (default 2 seconds)
- Auto-refresh can be toggled on/off per page
- All API calls include error handling and user-friendly messages
- Components are reusable and styled with Tailwind CSS

## Future Enhancements

- WebSocket support for real-time updates
- Authentication/authorization
- Multi-project dashboard
- Task dependency visualization
- Performance metrics dashboard
- Export logs functionality

