# Appendices (Schemas & Examples)

## Extended Task Schema (excerpt)
- Fields: `task_id`, `intent`, `instructions`, `task_type`, `acceptance_criteria`, `retry_policy`, `status`, `working_directory`, `agent_mode`.
- Multi-agent additions: `agent_role`, `preferred_providers`, `subtasks` (strategy, predefined_subtasks), `pipeline` (stages), `validation_strategy` (ensemble), `resource_constraints`.

## Example Configurations
- **Role Specialization**: Docs task with `agent_role=documenter`, providers [GEMINI, COPILOT].
- **Sequential Subtasks**: Auth system with design → implementation → tests and dependencies.
- **Parallel Pipeline**: Dashboard widgets built in parallel, integrated in a merge stage.
- **Ensemble Validation**: AES-256 task with validators (security, correctness, performance) using weighted majority and confidence threshold.
