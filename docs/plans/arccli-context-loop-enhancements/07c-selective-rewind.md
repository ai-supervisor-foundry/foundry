# 07c — Selective Rewind

## Source Files
- `crates/arc-fork/src/selective_rewind.rs` — RewindScope, restore logic

## Rewind Scope

```typescript
type RewindScope =
  | { type: 'full' }                    // revert everything
  | { type: 'code_only' }              // revert files, keep conversation
  | { type: 'conversation_only' }      // revert conversation, keep files
  | { type: 'specific_files'; paths: string[] };
```

## Rewind Implementation

```typescript
interface RewindResult {
  filesReverted: string[];
  filesSkipped: string[];
  conversationReverted: boolean;
}

async function selectiveRewind(
  snapshot: SessionSnapshot,
  workingDir: string,
  scope: RewindScope,
): Promise<RewindResult> {
  const result: RewindResult = {
    filesReverted: [], filesSkipped: [], conversationReverted: false
  };

  if (scope.type === 'full' || scope.type === 'code_only') {
    for (const [relPath, record] of snapshot.fileState.files) {
      const absPath = path.join(workingDir, relPath);
      const content = typeof record.content === 'string'
        ? record.content
        : await loadBlob(record.content.blobRef);
      fs.writeFileSync(absPath, content);
      fs.chmodSync(absPath, record.permissions);
      result.filesReverted.push(relPath);
    }
  }

  if (scope.type === 'specific_files') {
    for (const p of scope.paths) {
      const record = snapshot.fileState.files.get(p);
      if (record) {
        /* restore file */ result.filesReverted.push(p);
      } else {
        result.filesSkipped.push(p);
      }
    }
  }

  if (scope.type === 'full' || scope.type === 'conversation_only')
    result.conversationReverted = true;

  return result;
}
```

## Commands

- `/rewind <checkpoint>` — full scope revert
- `/rewind --code-only <checkpoint>` — revert files only
- `/rewind --files src/a.ts,src/b.ts <checkpoint>` — specific files

## Acceptance Criteria

- [ ] Selective rewind: full, code-only, conversation-only, specific files
- [ ] File permissions restored on rewind
- [ ] Skipped files reported in result
