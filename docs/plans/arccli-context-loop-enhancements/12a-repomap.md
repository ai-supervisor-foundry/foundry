# 12a — Repomap: Structural AST Map

## Source Files
- `crates/arc-repomap/src/lib.rs` — Tree-sitter extraction, parallel processing

## Purpose

Generates compressed codebase overview by extracting **signatures only** (no bodies).
Reduces context tokens ~80% vs. full file inclusion.

## RepoMap Class

```typescript
class RepoMap {
  constructor(private root: string) {}

  async generateMap(): Promise<string> {
    const files = await walkGitTracked(this.root);
    const entries = await Promise.all(
      files.map(f => this.extractSignatures(f))
    );
    return entries
      .filter(e => e.signatures.length > 0)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(e => `File: ${e.path}\n${e.signatures.map(s => `  ${s}`).join('\n')}`)
      .join('\n\n');
  }
}
```

## Language Support & Patterns

| Language | Extracts |
|----------|----------|
| TypeScript/TSX | function declarations, classes, interfaces, types |
| Python | function defs, class defs |
| Rust | fn, struct, trait, impl |
| Go | func, method, type declarations |
| C/C++ | function defs, class defs |

**Extraction rule**: First line of each declaration only (the signature).

## Regex Alternative (No Tree-sitter Needed)

For TypeScript projects, regex may be sufficient:

```typescript
const TS_SIGNATURES = [
  /^export\s+(async\s+)?function\s+\w+[^{]*/gm,
  /^export\s+(default\s+)?class\s+\w+[^{]*/gm,
  /^export\s+(interface|type)\s+\w+[^{]*/gm,
  /^\s+(async\s+)?\w+\s*\([^)]*\)\s*[:{]/gm,  // class methods
];
```

## Output Format

```
=== Repository Structural Map ===
File: src/core/scheduler.ts
  export class ParallelScheduler
  async schedule(tasks: Task[]): Promise<void>
  private validateDependencies(task: Task): boolean

File: src/adapters/anthropic.ts
  export class AnthropicAdapter implements Provider
  async chat(messages: Message[]): Promise<ChatResponse>
```

Sorted deterministically by file path for stable diffs.

## When to Inject Repomap

- Agent modifying >2 files (heuristic)
- User asks about codebase structure
- Planning phase needs file dependency understanding
- Agent navigating unfamiliar code areas

**Budget**: Repomap output ≤ 10% of context budget.

## Acceptance Criteria

- [ ] Extracts signatures for TS/Python/Rust/Go
- [ ] Output sorted deterministically
- [ ] Supports both tree-sitter and regex fallback
- [ ] Size capped at 10% of context budget
- [ ] Gitignore-aware file walking
