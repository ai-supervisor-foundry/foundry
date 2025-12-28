# State Storage

- The supervisor state store is DragonflyDB.
- DragonflyDB is used as a Redis-compatible key-value store.
- No Redis cluster features are used.
- No pub/sub is used.
- No streams are used.
- No Lua scripts are used.

Storage model:
- Single key holds the entire supervisor state.
- Value is serialized JSON.
- Reads and writes are explicit and synchronous.

DragonflyDB is infrastructure, not logic.

