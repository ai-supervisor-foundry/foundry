# 001 - Rules Block Consolidation (Agent Instructions)

Purpose: unify all behavioral constraints into a single Rules block immediately after Acceptance Criteria in every prompt builder variant.

## Inserted Rules Block (verbatim)
```
## Rules
- Use ONLY information from Task Description, Acceptance Criteria, and READ-ONLY CONTEXT
- Do NOT paraphrase, infer, or speculate beyond what is explicitly stated
- If critical details (file paths, API signatures, variable names) are missing, STOP and ask ONE clarifying question
- Remain in {AGENT_MODE} MODE throughout execution
- Reference only files that exist in sandbox_root; verify before mentioning
- Keep responses minimal: code changes + final JSON block only
- Do NOT explain what you're about to do; just do it
```

## Early-Stop Triggers (examples to keep in Rules)
- Task: "update the config" → ask which file (vite.config.ts vs tsconfig.json vs .env)
- Task: "call the API" → ask which endpoint
- Task: "use the auth token" → ask where it is stored

Example early-stop response:
```json
{
  "status": "failed",
  "files_created": [],
  "files_updated": [],
  "changes": [],
  "neededChanges": false,
  "summary": "Cannot proceed: which config file should be updated (vite.config.ts, tsconfig.json, or .env)?"
}
```

## Removals/merges (per file)
- Remove standalone lines: "Remain in X MODE", "Halt on ambiguity", "Do not assume" — they are covered by Rules.

## Notes
- Keep this block in buildPrompt, buildFixPrompt, buildClarificationPrompt.
- For behavioral tasks, you may skip halting; otherwise keep full Rules block.