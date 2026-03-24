# 07b — Fork Tree Manager

## Source Files
- `crates/arc-fork/src/fork.rs` — ForkManager, Fork, ForkChild
- `tests/integration/session_fork_resume.rs` — Fork tree tests

## Fork Schema

```typescript
interface Fork {
  id: string;
  snapshotId: string;
  label: string;
  createdAt: Date;
  parentForkId: string | null;
  children: ForkChild[];
}

interface ForkChild {
  sessionId: string;
  label: string;
  createdAt: Date;
  description: string;
  active: boolean;
}
```

## Fork Manager

```typescript
class ForkManager {
  private forks: Map<string, Fork>;
  private snapshots: Map<string, SessionSnapshot>;

  createFork(label: string, snapshot: SessionSnapshot): string {
    // Create fork, link to snapshot, return fork ID
  }

  resumeFromFork(forkId: string, branchLabel: string): string {
    // Create new session from fork's snapshot, return session ID
  }

  listForks(): Fork[] { }

  forkTree(): Map<string, string[]> {
    // parent fork ID → child fork IDs
  }
}
```

## Commands

- `/fork <label>` — create fork at current turn
- `/resume <fork-id> <branch-label>` — start new session from fork

## Acceptance Criteria

- [ ] Fork tree with parent-child relationships
- [ ] createFork and resumeFromFork operations
- [ ] Fork tree traversal for listing branches
