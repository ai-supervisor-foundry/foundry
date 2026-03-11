# Plan: Supervisor ↔ UI Alignment

- **Problem**: Supervisor’s `project_id`, `tool`, and `working_directory` semantics don’t line up cleanly with how the UI discovers “projects”, selects providers, and locates logs, so the UI often shows empty or misleading views even when execution is healthy.
- **Goal**: Make the UI a truthful, low-friction window into the Supervisor’s execution by aligning project selection, provider selection, and execution/log context, without changing the deterministic control loop.

