# Configuration

## Environment Variables

```bash
export CURSOR_CLI_PATH=/path/to/cursor  # Optional, defaults to 'cursor'
export OPENROUTER_API_KEY=your_key      # For OpenRouter integration

# Provider Strategy (default: '1')
# Strategy 1 (claude-primary): primary = Claude→Cursor→Gemini, secondary = Cursor→Gemini→Ollama
# Strategy 2 (cursor-primary): primary = Cursor→Gemini→Claude, secondary = Gemini→Ollama→Claude
export PROVIDER_STRATEGY=1

# Override primary adapter priority list (comma-separated, overrides strategy primary)
export CLI_PROVIDER_PRIORITY=claude,cursor,gemini

# Ollama config (used when Ollama appears in secondary priority chain)
export OLLAMA_BASE_URL=http://localhost:11434  # default
export LOCAL_HELPER_MODEL=phi4-mini            # default agentMode for Ollama in strategies

# Circuit breaker TTL in seconds (default: 86400 = 1 day)
export CIRCUIT_BREAKER_TTL_SECONDS=86400
```

> **Deprecated**: `USE_LOCAL_HELPER_AGENT` — Ollama inclusion is now controlled by the active strategy's secondary provider list.

## CLI Global Options

All commands require:
- `--redis-host <host>` - DragonflyDB host (default: `localhost`)
- `--redis-port <port>` - DragonflyDB port (default: `6499`)
- `--state-key <key>` - Supervisor state key (e.g., `supervisor:state`)
- `--queue-name <name>` - Task queue name (e.g., `tasks`)
- `--queue-db <index>` - Queue database index (must differ from state DB, e.g., `2`)
- `--state-db <index>` - State database index (optional, default: `0`)
- `--sandbox-root <path>` - Sandbox root directory (optional, default: `./sandbox`)
