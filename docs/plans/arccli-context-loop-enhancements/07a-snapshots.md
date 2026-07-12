# 07a — Session Snapshots & File State

## Source Files
- `crates/arc-fork/src/snapshot.rs` — SessionSnapshot, FileState
- `crates/arc-session/src/session_model.rs` — FileModificationRecord

## Session Snapshot Schema

```typescript
interface SessionSnapshot {
  id: string;                           // UUID
  sessionId: string;
  parentSnapshotId: string | null;
  createdAt: Date;
  turnNumber: number;
  label: string;
  conversation: ConversationState;
  fileState: FileState;
}

interface ConversationState {
  messages: ConversationMessage[];
  totalTokens: number;
  systemPromptHash: string;
}

interface ConversationMessage {
  role: string;
  content: string;
  timestamp: Date;
  tokenCount: number;
  toolCalls: ToolCallRecord[];
}

interface ToolCallRecord {
  toolName: string;
  inputSummary: string;
  outputSummary: string;
  filesModified: string[];
}
```

## File State with Content-Addressable Storage

```typescript
interface FileState {
  files: Map<string, FileRecord>;       // relative path → record
}

interface FileRecord {
  hash: string;                         // SHA-256
  content: string | { blobRef: string }; // inline <1MB, else blob ref
  permissions: number;                   // Unix mode
}
```

SHA-256 hash as blob_id enables deduplication across snapshots.

## Capture & Diff

```typescript
function captureFileState(projectRoot: string): FileState {
  // Walk all tracked files, compute SHA-256, store content
}

function diffFileStates(a: FileState, b: FileState): FileDiff[] {
  // Compare by hash → Added / Modified / Deleted
}
```

## File Modification Record (Undo Buffer)

```typescript
interface FileModificationRecord {
  path: string;
  originalContent: string | null;       // null if newly created
  modifiedAt: Date;
  action: 'created' | 'modified' | 'deleted';
}
```

Store `originalContent` on every file write → enables per-file undo.

## Checkpoint Naming

`{sessionId.slice(0,8)}_{turnNumber.toString().padStart(4,'0')}.json`
Example: `a1b2c3d4_0015.json`

## Acceptance Criteria

- [ ] Atomic snapshot captures both conversation + file state
- [ ] SHA-256 content-addressable file storage
- [ ] File modification records store original content for undo
- [ ] Checkpoint naming follows `{id}_{turn}.json` convention
- [ ] diffFileStates compares by hash, returns typed diffs
