# DragonflyDB Constraints

- DragonflyDB is **single-node only**
- Default configuration is used
- No performance tuning
- No eviction policy changes
- No persistence mode changes without operator instruction
- Availability is assumed local-only
- **No Lua scripts** (use Redis List operations only)
- **No pub/sub** (not supported)
- **No clustering** (single instance only)
