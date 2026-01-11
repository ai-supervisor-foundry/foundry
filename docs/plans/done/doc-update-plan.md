# Documentation Update Plan

## Objective
Update project documentation and configuration examples to reflect the current set of environment variables used in the codebase. This ensures operators can correctly configure the Supervisor and its new components (Hexagonal Architecture, Helper Agents, Deterministic Validation).

## 1. Missing Environment Variables
The following variables exist in the codebase but are missing from `.env.example`.

### Redis & State Management
| Variable | Default | Description |
| :--- | :--- | :--- |
| `REDIS_HOST` | `localhost` | Hostname for the Dragonfly/Redis instance. |
| `REDIS_PORT` | `6499` | Port for Dragonfly/Redis. |
| `STATE_KEY` | `supervisor:state` | Redis key for storing supervisor persistence. |
| `STATE_DB` | `0` | Redis DB index for persistence. |
| `QUEUE_NAME` | `tasks` | Redis key/queue name for the task queue. |
| `QUEUE_DB` | `2` | Redis DB index for the queue. |
| `SANDBOX_ROOT` | `./sandbox` | Path to the sandbox directory (used by UI). |

### AI Provider CLIs (Paths)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `GEMINI_CLI_PATH` | `gemini` / `npx` | Path to Gemini CLI executable. |
| `COPILOT_CLI_PATH` | `npx` | Path to Copilot CLI executable. |
| `CLAUDE_CLI_PATH` | `claude` | Path to Claude CLI executable. |
| `CURSOR_CLI_PATH` | `cursor` | Path to Cursor CLI executable. |
| `CODEX_CLI_PATH` | `npx` | Path to Codex CLI executable. |
| `CLI_PROVIDER_PRIORITY` | (undefined) | Comma-separated list defining provider fallback order. |

### Helper Agent & Validation
| Variable | Default | Description |
| :--- | :--- | :--- |
| `HELPER_AGENT_MODE` | `auto` | Mode for the Helper Agent (`auto`, `manual`). |
| `HELPER_DETERMINISTIC_ENABLED` | `true` | Enable deterministic file validation. |
| `HELPER_DETERMINISTIC_PERCENT` | `100` | Sampling percentage for deterministic checks. |
| `HELPER_DETERMINISTIC_MAX_FILES` | `2000` | Max files to scan during deterministic validation. |
| `HELPER_DETERMINISTIC_MAX_BYTES` | `10485760` | Max bytes to read during scanning (10MB). |

### System Configuration
| Variable | Default | Description |
| :--- | :--- | :--- |
| `CIRCUIT_BREAKER_TTL_SECONDS` | `86400` | Time-to-live for provider failure flags. |
| `NODE_ENV` | (undefined) | Node environment (`development`, `production`). |
| `PORT` | `3001` | Port for the Supervisor UI backend. |
| `POLL_INTERVAL` | `60000` | Polling interval for UI updates (ms). |

## 2. Documents Requiring Updates

The following documents need to be updated to include these configuration details:

1.  **`.env.example`**
    *   **Action:** Add all missing sections with default values commented out.
    *   **Priority:** High (Critical for setup).

2.  **`README.md`**
    *   **Action:** Update the "Configuration" or "Setup" section.
    *   **Detail:** Mention the existence of the UI and Helper Agent config.

3.  **`docs/runbook.md` (or `RUNBOOK.md`)**
    *   **Action:** Update the "Environment Setup" section.
    *   **Detail:** Explain the specific impact of `HELPER_DETERMINISTIC_*` flags for performance tuning.

4.  **`docs/helper-docs/gemini-cli-params.md` & `cursor-cli-params.md`**
    *   **Action:** Ensure the `_CLI_PATH` variables are documented as the method to override default executables.

5.  **`UI/README.md`**
    *   **Action:** Document `PORT`, `POLL_INTERVAL`, and `SANDBOX_ROOT` specific to the UI.

## 3. Execution Order
1.  Update `.env.example`.
2.  Update `README.md`.
3.  Update `RUNBOOK.md` (if exists).
