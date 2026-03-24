# 06a — Static Policy Engine

## Source Files
- `crates/arc-policy/src/engine.rs` — PolicyEngine
- `crates/arc-policy/src/rules.rs` — PolicyRule enum, evaluate functions

## Policy Rule Types

```typescript
type PolicyRule =
  | { type: 'no_force_push' }
  | { type: 'no_env_file_read' }
  | { type: 'require_tests_for_paths'; paths: string[] }
  | { type: 'forbidden_command'; name: string; pattern: RegExp; severity: RuleSeverity }
  | { type: 'forbidden_path'; name: string; glob: string; writeOnly: boolean };

type RuleSeverity = 'deny' | 'warn';
```

## Evaluation Result

```typescript
interface PolicyViolation {
  ruleName: string;
  severity: RuleSeverity;
  message: string;
}

interface PolicyResult {
  isAllowed: boolean;
  violations: PolicyViolation[];
}
```

`Deny` violations block the action. `Warn` violations log but proceed.

## PolicyEngine Class

```typescript
class PolicyEngine {
  constructor(private rules: PolicyRule[]) {}

  evaluateCommand(command: string): PolicyResult {
    const violations: PolicyViolation[] = [];
    for (const rule of this.rules) {
      if (rule.type === 'no_force_push' && /push.*--force/.test(command))
        violations.push({ ruleName: 'no_force_push', severity: 'deny', message: '...' });
      if (rule.type === 'forbidden_command' && rule.pattern.test(command))
        violations.push({ ruleName: rule.name, severity: rule.severity, message: '...' });
    }
    return {
      isAllowed: !violations.some(v => v.severity === 'deny'),
      violations,
    };
  }

  evaluateFileAccess(filePath: string, isWrite: boolean): PolicyResult {
    // Check forbidden_path rules, no_env_file_read, require_tests_for_paths
  }
}
```

## Default Rules

1. `no_force_push` — blocks `git push --force`
2. `no_env_file_read` — blocks reading `.env` files
3. `require_tests_for_paths` — requires test coverage for `src/core/` changes

## Acceptance Criteria

- [ ] PolicyEngine evaluates both commands and file access
- [ ] Deny violations block; Warn violations log but proceed
- [ ] Default rules loaded on initialization
- [ ] Custom rules addable via project config
