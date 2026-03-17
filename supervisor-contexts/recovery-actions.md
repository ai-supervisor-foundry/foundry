---
description: Recovery procedures for crashes, stale state, and provider failures
---

# Recovery Actions

- **Cursor CLI crash** → Reload rules & state, reissue last task
- **Supervisor restart** → Load last saved state, resume from next task
- **Partial task** → Flag blocked, operator input required
- **Conflicting state** → Halt and request resolution
- **State persistence failure** → Halt immediately
