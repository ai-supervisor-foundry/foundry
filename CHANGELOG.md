## v0.1.0 (2026-03-20)

Initial release combining PRs #18, #19, and #20.

### Core (PR #19)

- Parallel scheduler with configurable worker pool and git worktree isolation
- Hybrid memory system for improved context management
- Safety layer with pre/post execution hooks (programmatic, operator-configurable)
- Multi-goal/adapter support with per-project goal configuration
- MCP removed from CLI providers to reduce context consumption
- Shared cache with locking (exponential backoff + timeout)

### UI Dashboard (PR #20)

- Settings page with CRUD for strategies and execution modes
- Chat visualizer with multi-format agent response parsing and preview extraction
- Indigo theme refresh: rounded-xl cards, backdrop-blur modals, focus-visible rings
- Execution mode preferences validated against DB instead of hardcoded allowlist
- Builtin execution modes listed first, custom modes sorted by creation date
- Duplicate-to-create for tasks, strategies, and execution modes
- Logs and settings tab persistence via URL search params
- Backend API tests (41) and frontend chat parsing tests (52)

### Fixes (PR #18)

- Cursor provider adapter fixes
