# Configuration

## Environment Variables

```bash
export CURSOR_CLI_PATH=/path/to/cursor  # Optional, defaults to 'cursor'
export OPENROUTER_API_KEY=your_key      # For OpenRouter integration
```

## CLI Global Options

All commands require:
- `--redis-host <host>` - DragonflyDB host (default: `localhost`)
- `--redis-port <port>` - DragonflyDB port (default: `6499`)
- `--state-key <key>` - Supervisor state key (e.g., `supervisor:state`)
- `--queue-name <name>` - Task queue name (e.g., `tasks`)
- `--queue-db <index>` - Queue database index (must differ from state DB, e.g., `2`)
- `--state-db <index>` - State database index (optional, default: `0`)
- `--sandbox-root <path>` - Sandbox root directory (optional, default: `./sandbox`)
