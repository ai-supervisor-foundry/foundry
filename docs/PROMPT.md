# Prompt Construction (Current)

## Rules Block (enforced)
- Use ONLY information from Task Description, Acceptance Criteria, and injected context; do not speculate.
- Do NOT paraphrase or add unstated requirements.
- Validate file paths (no absolute paths, no traversal, must exist under sandbox_root when referenced).
- Ask at most one clarifying question when blocked by ambiguity; otherwise proceed.

## Output Requirements (JSON-only)
Your response MUST end with ONLY this JSON block:
```json
{
	"status": "completed" | "failed",
	"neededChanges": true | false,
	"summary": "One-sentence summary",
	"files_created": ["relative/path/from/sandbox_root"],
	"files_updated": ["relative/path/from/sandbox_root"],
	"changes": ["relative/path/from/sandbox_root"]
}
```

## Task-Type Guidelines
- **Implementation/Code**: Cover edge cases, prefer minimal diff, respect existing patterns; include tests when criteria mention them.
- **Behavioral/Conversational**: Provide direct answers; no file changes expected; keep response concise and relevant.
- **Configuration/Docs**: Modify only specified files; reflect acceptance criteria verbatim.
- **Testing**: Run or describe tests per criteria; report pass/fail with evidence.

## Context Injection (minimal state)
- Include goal, current task, last few completed tasks, blocked tasks, and queue snippets only when relevant to the task.
- Do not inject full state; prefer minimal, task-relevant context to reduce prompt size.

## Agents/Providers
- Prompts are dispatched via Agents/Providers (Gemini, Copilot, Cursor); content must remain provider-agnostic.

