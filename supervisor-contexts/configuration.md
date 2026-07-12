---
description: Environment variables, CLI flags, and provider strategy config
---

# Configuration

## Environment Variables

```bash
export CURSOR_CLI_PATH=/path/to/cursor  # Optional, defaults to 'cursor'
# Cursor CLI: Foundry passes --trust on `cursor agent` for non-interactive workers
export OPENROUTER_API_KEY=your_key      # For OpenRouter integration

# Provider Strategy (default: '1')
# Strategy 1 (claude-primary): primary = Claude→Cursor→Gemini, secondary = Cursor→Gemini→Ollama
# Strategy 2 (cursor-primary): primary = Cursor→Gemini→Claude, secondary = Gemini→Ollama→Claude
# Strategy 3 (gemini-primary): primary = Gemini→Claude→Cursor, secondary = Cursor→Gemini-2.5→Claude→Ollama
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

## Settings Persistence

Configurable settings (Provider Strategy, Sandbox Root, Ollama Base URL, Circuit Breaker TTL) are stored in the Postgres `settings` table and editable via the UI Settings page (`/settings`).

**Precedence**: `.env` > Postgres > hardcoded defaults. `.env` values take runtime priority but Postgres values remain editable as fallback. The UI writes to Postgres only.

## Strategies & Execution Modes (Postgres)

Provider strategies and execution modes are stored in `strategies` and `execution_modes` Postgres tables. Built-in entries (3 strategies, 4 execution modes) are seeded on first startup and marked `builtin = true` (cannot be deleted). Custom entries can be created, edited, and deleted via the Settings UI.

`getActiveStrategy()` in `src/config/agents/providers/strategies.ts` reads from Postgres (with .env `PROVIDER_STRATEGY` override). Custom strategies are resolved from the `strategies` table.
