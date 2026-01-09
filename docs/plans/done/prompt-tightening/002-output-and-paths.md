# 002 - Output Contract & Path Validation

Purpose: enforce JSON-only responses and reject hallucinated file paths.

## JSON-Only Output (replace Output Requirements section)
```
## Output Requirements
Your response MUST end with ONLY this JSON block. Do NOT include prose before or after.

If you made no file changes, use empty arrays: "files_created": [], "files_updated": [], "changes": []
If you are unsure or cannot complete, set "status": "failed" and explain briefly in summary.

```json
{
  "status": "completed" | "failed",
  "files_created": ["relative/path/from/sandbox_root"],
  "files_updated": ["relative/path/from/sandbox_root"],
  "changes": ["relative/path/from/sandbox_root"],
  "neededChanges": true | false,
  "summary": "One sentence describing what was done or why it failed"
}
```

Do not add any other fields. Use the exact keys provided. All file paths must be relative to sandbox_root.
```

## Path Validation Utility (add)
```typescript
export function validateFilePaths(paths: string[], sandboxRoot: string): string[] {
  const fs = require('fs');
  const path = require('path');

  return paths.filter(filePath => {
    if (path.isAbsolute(filePath)) {
      logVerbose('ValidateFilePaths', 'Filtered absolute path', { filePath });
      return false;
    }
    if (filePath.startsWith('~') || filePath.includes('../')) {
      logVerbose('ValidateFilePaths', 'Filtered suspicious path', { filePath });
      return false;
    }
    const fullPath = path.join(sandboxRoot, filePath);
    const exists = fs.existsSync(fullPath);
    if (!exists) {
      logVerbose('ValidateFilePaths', 'Filtered non-existent path', { filePath });
    }
    return exists;
  });
}
```

## Integration (controlLoop.ts after providerResult parsing)
```typescript
if (providerResult.files_created) {
  const originalCount = providerResult.files_created.length;
  providerResult.files_created = validateFilePaths(providerResult.files_created, sandboxCwd);
  const filteredCount = originalCount - providerResult.files_created.length;
  if (filteredCount > 0) {
    logVerbose('ControlLoop', 'Filtered hallucinated paths from files_created', {
      filtered_count: filteredCount,
      task_id: task.task_id,
    });
  }
}
if (providerResult.files_updated) {
  providerResult.files_updated = validateFilePaths(providerResult.files_updated, sandboxCwd);
}
if (providerResult.changes) {
  providerResult.changes = validateFilePaths(providerResult.changes, sandboxCwd);
}
```

## Agent-facing reminders
- Paths must be relative to sandbox_root.
- If unsure, return status="failed" with short summary; never fabricate paths.