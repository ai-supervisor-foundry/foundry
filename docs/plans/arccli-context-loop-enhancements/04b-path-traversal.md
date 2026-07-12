# 04b — Path Traversal Guard & File Protection

## Source Files
- `tests/security/path_traversal.rs` — Path sanitization
- `crates/arc-tools/src/security/path_guard.rs` — PathGuard

## Path Sanitization

```typescript
function sanitizePath(base: string, requested: string): string | null {
  const absolute = path.resolve(base, requested);
  const canonical = fs.realpathSync(absolute);  // resolves symlinks
  const canonicalBase = fs.realpathSync(base);
  if (!canonical.startsWith(canonicalBase + path.sep))
    return null;  // traversal attempt
  return canonical;
}
```

## Filename Validation

```typescript
function isSafeFilename(name: string): boolean {
  return !/\.\./.test(name)        // no parent traversal
    && !name.includes('\0')        // no null bytes
    && !/^[/\\]/.test(name)        // no absolute paths
    && !name.includes('://');      // no URL scheme injection
}

// Checkpoint/session IDs: strict alphanumeric
const VALID_ID = /^[a-zA-Z0-9_-]{1,64}$/;
```

## Sensitive File Write Protection

Block writes to these patterns:

```typescript
const PROTECTED_FILE_PATTERNS = [
  /^\.env($|\.)/,        // .env, .env.local, .env.production
  /^\.git\//,            // git internals
  /id_rsa/,              // SSH keys
  /id_ed25519/,
  /\.pem$/,              // certificates
  /\.key$/,              // private keys
  /\.ssh\//,
  /\.gnupg\//,
  /\.aws\//,
  /credentials\.json$/,
];
```

## PathGuard Class

```typescript
interface PathGuardConfig {
  projectRoot: string;
  extraAllowed: string[];         // additional allowed dirs
  writableExtensions: string[];   // e.g. ['.ts', '.js', '.json']
  maxFileSize: number;            // bytes
}

class PathGuard {
  validateRead(filePath: string): boolean {
    // 1. Resolve to absolute
    // 2. Canonicalize (resolve symlinks)
    // 3. Check starts with project root
    // 4. Not in blocked dirs (.ssh, .gnupg, .aws)
  }

  validateWrite(filePath: string, size: number): boolean {
    // All read checks PLUS:
    // 1. Extension in writableExtensions
    // 2. Size under maxFileSize
    // 3. Not in PROTECTED_FILE_PATTERNS
    // 4. Not in .git/ .arc/ .ssh/
  }
}
```

## Acceptance Criteria

- [ ] Path traversal guard resolves symlinks and checks containment
- [ ] Filename validation rejects `..`, null bytes, URL schemes
- [ ] Sensitive file writes blocked with clear error message
- [ ] PathGuard validates both read and write operations
- [ ] Session/checkpoint IDs validated against strict regex
