# 09b — Plugin Integrity Hash & Registry

## Source Files
- `crates/arc-plugins/src/installer.rs` — Download, verify, install
- `crates/arc-plugins/src/registry.rs` — Track installed plugins
- `crates/arc-plugins/src/marketplace.rs` — Browse/search remote

## SHA-256 Integrity Hash

```typescript
function computePluginHash(pluginDir: string): string {
  const files = walkSync(pluginDir)
    .sort()                    // deterministic order
    .filter(f => !f.startsWith('.git'));
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(file);                       // include filename
    hash.update(fs.readFileSync(path.join(pluginDir, file)));
  }
  return hash.digest('hex');
}
```

- Computed on install, re-verified on load
- Mismatch = tamper detected → refuse load with error

## Plugin Registry

```typescript
interface PluginRegistryEntry {
  name: string;
  version: string;
  installPath: string;
  integrityHash: string;
  enabled: boolean;
  installedAt: string;
  source: {
    type: 'local' | 'git' | 'marketplace';
    url?: string;
  };
}

// Persisted in .supervisor/plugins.json
```

## Loaded Plugin (Runtime)

```typescript
interface LoadedPlugin {
  manifest: PluginManifest;
  installPath: string;
  commands: PluginCommand[];
  agents: PluginAgent[];
  skills: PluginSkill[];
  hooks: PluginHook[];
  mcpConfigs: { serverName: string; configFile: string }[];
  integrityHash: string;
  installedAt: Date;
}

function loadPlugin(dir: string): LoadedPlugin {
  // 1. Read plugin.json manifest
  // 2. Verify integrity hash matches registry
  // 3. Auto-discover components from subdirectories
  // 4. Return assembled LoadedPlugin
}
```

## Plugin Hook Attribution

Every hook installed by a plugin carries `installedByPlugin: pluginName`.
Enables bulk operations:
- `disablePluginHooks(pluginName)` — disable all hooks from one plugin
- `uninstallPlugin(name)` — removes all hooks, commands, agents, skills

## Plugin Lifecycle

```
install → compute hash → register in plugins.json → load components
update  → re-download → re-compute hash → verify → reload
enable  → set enabled=true → load components
disable → set enabled=false → unload components
remove  → unload → delete files → remove from registry
```

## Acceptance Criteria

- [ ] SHA-256 integrity hash computed on install, verified on load
- [ ] Registry persists installed plugin state to disk
- [ ] Plugin hook attribution enables bulk management
- [ ] Load refuses tampered plugins (hash mismatch)
- [ ] Lifecycle: install/update/enable/disable/remove
