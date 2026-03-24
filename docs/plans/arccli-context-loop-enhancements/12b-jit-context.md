# 12b — JIT Context Discovery & Context Directives

## Source Files
- `crates/arc-core/src/jit_context.rs` — Auto-discover on tool use
- `crates/arc-core/src/context_file.rs` — Context file system, directives
- `docs/enterprise_features.md` — Context directives

## JIT Context Discovery

When a high-intent tool fires, auto-discover and inject context files from the
accessed directory up to the project root.

```typescript
const HIGH_INTENT_TOOLS = [
  'read_file', 'write_file', 'file_edit', 'list_directory',
  'replace', 'insert', 'create_file',
];

function discoverJitContext(
  accessedPath: string,
  projectRoot: string,
  alreadyLoaded: Set<string>,
): JitContextEntry[] {
  const entries: JitContextEntry[] = [];
  let dir = path.dirname(accessedPath);

  while (dir.startsWith(projectRoot)) {
    for (const name of ['CLAUDE.md', 'ARC.md', '.claude/context.md']) {
      const contextPath = path.join(dir, name);
      if (!alreadyLoaded.has(contextPath) && fs.existsSync(contextPath)) {
        entries.push({ path: contextPath, content: fs.readFileSync(contextPath, 'utf-8'), directory: dir });
        alreadyLoaded.add(contextPath);
      }
    }
    dir = path.dirname(dir);
  }
  return entries;
}
```

## Context Directives

Parsed from HTML comments in context files:

```typescript
type ContextDirective =
  | { type: 'always_include'; paths: string[] }
  | { type: 'never_modify'; globs: string[] }
  | { type: 'style_rule'; rule: string }
  | { type: 'system_prompt_addition'; text: string }
  | { type: 'test_command'; command: string }
  | { type: 'build_command'; command: string }
  | { type: 'forbidden_pattern'; pattern: string };

// Parsed from: <!-- arc:always_include src/types.ts -->
//          or: @arc-never_modify *.lock
```

## Context File Priority

Project-level (higher priority, loaded second):
1. `CLAUDE.md` (project root)
2. `.supervisor/context.md`

Global (lower priority, loaded first):
1. `~/.supervisor/context.md`
2. `~/.supervisor/global_context.md`

Max file size: 256KB. If exceeded, skip with warning.

## Context Hot-Reload

Watch context files with `chokidar` (100ms debounce). On change, re-parse
directives and push updated context to the live session.

## Prompt Caching

Context files that rarely change should use Anthropic's
`cache_control: { type: "ephemeral" }` header to reduce input token billing
(85-90% savings on repeat calls).

## Acceptance Criteria

- [ ] JIT context walks directory tree on high-intent tool use
- [ ] Context directives parsed from HTML comments
- [ ] Priority: global < project-level
- [ ] Hot-reload via file watcher with debounce
- [ ] Max 256KB per context file
- [ ] Prompt caching header on static context blocks
