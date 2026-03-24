# 09a — Plugin Manifest & Directory Layout

## Source Files
- `crates/arc-plugins/src/manifest.rs` — PluginManifest, PluginMeta
- `tests/integration/plugin_install.rs` — Manifest + structure tests

## Plugin Directory Layout

```
my-plugin/
├── plugin.json              # Manifest
├── commands/                # Slash command definitions
│   └── greet.json
├── agents/                  # Agent definitions
│   └── reviewer.md
├── skills/                  # Auto-invoked skills
│   └── lint.md
├── hooks/                   # Lifecycle hooks
│   └── pre-commit.json
└── mcp/                     # MCP server configs
    └── server.json
```

Convention-over-config: each subdirectory is auto-discovered and loaded.

## Plugin Manifest Schema

```typescript
interface PluginManifest {
  plugin: PluginMeta;
  dependencies?: Record<string, string>;  // name → version range
  config?: Record<string, ConfigField>;
}

interface PluginMeta {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  minSupervisorVersion?: string;
  tags: string[];
  homepage?: string;
  repository?: string;
}

interface ConfigField {
  description: string;
  type: 'string' | 'number' | 'boolean';
  default?: unknown;
  required: boolean;
}
```

## Plugin Components

```typescript
interface PluginCommand {
  name: string;
  description: string;
  handler: CommandHandler;
  args: CommandArg[];
}

type CommandHandler =
  | { type: 'script'; path: string }
  | { type: 'inline'; command: string }
  | { type: 'agent'; agentName: string; promptTemplate: string };

interface PluginAgent {
  name: string;
  description: string;
  systemPromptFile: string;
  tools: string[];
  modelOverride?: string;
}

interface PluginSkill {
  name: string;
  description: string;
  triggerPatterns: string[];     // regex for auto-invocation
  promptFile: string;
}

interface PluginHook {
  name: string;
  hookConfig: HookDefinition;   // from 03b
}
```

## Acceptance Criteria

- [ ] Directory auto-discovers components from subdirectories
- [ ] Manifest validates required fields (name, version, author)
- [ ] CommandHandler supports script, inline, and agent delegation
- [ ] Plugins can provide agents, skills, hooks, commands, MCP configs
