# Recovery Actions

When something goes wrong, the supervisor and operator respond as follows. For what gets logged in each case, see [logging-auditability.md](./logging-auditability.md).

| Scenario | Action |
|----------|--------|
| **Provider CLI crash** (e.g. Cursor/Gemini exits unexpectedly) | Reload rules and state, reissue the last task. |
| **Supervisor process restart** | Load last persisted state from DragonflyDB, resume from the next task in queue. |
| **Partial or failed task** (validation failed after max retries) | Task marked **blocked**; operator input required before continuing. |
| **Conflicting state** (e.g. duplicate keys, inconsistent queue) | Halt and request operator resolution. |
| **State persistence failure** (write to DragonflyDB fails) | Halt immediately; do not advance. |

After recovery, use **resume** (CLI or PM2 restart) to continue. Audit logs and verbose logs provide the trail for debugging (see [usage.md](./usage.md) for log paths and [logging-auditability.md](./logging-auditability.md) for log rules).
