# State Lifecycle

- State is initialized by the operator.
- State is loaded at the start of every control loop iteration.
- State is read-only during task execution.
- State is mutated only after validation.
- State is persisted immediately after mutation.
- State persistence failure halts execution.
- Tools (including Cursor CLI) do not access state directly. The supervisor injects the required state context into each task prompt.

