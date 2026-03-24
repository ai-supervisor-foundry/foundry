# 11a — Security CI & Nightly Audit

## Source Files
- `.github/workflows/security.yml` — Nightly audit + auto-issue
- `.github/workflows/fuzz.yml` — Weekly fuzzing
- `SECURITY.md` — Disclosure policy

## Nightly Security Audit

Daily at 06:00 UTC. Three tools chained:

```yaml
on:
  schedule:
    - cron: '0 6 * * *'

jobs:
  audit:
    steps:
      - run: npm audit --audit-level=high
      - run: npx license-checker --failOn 'GPL'
      - run: npx osv-scanner --lockfile package-lock.json
```

On failure: auto-create GitHub issue:

```yaml
      - uses: actions/github-script@v7
        if: failure()
        with:
          script: |
            github.rest.issues.create({
              owner, repo,
              title: `Security Audit Failed - ${date}`,
              labels: ['security', 'automated'],
              body: 'Nightly audit detected vulnerabilities.'
            });
```

## Weekly Fuzzing

Runs every Monday at 03:00 UTC. Targets:
- JSON config parsing
- SSE stream parsing
- Hook pattern regex compilation
- Plugin manifest parsing

TypeScript equivalent: `fast-check` with `numRuns: 100000` or `@jazzer.js/fuzzer`.

## CI Test Matrix

| Job | Scope | TS Equivalent |
|-----|-------|---------------|
| unit-tests | 3 OS matrix | `vitest run` on matrix |
| integration-tests | ubuntu + system deps | `vitest run --project integration` |
| property-tests | 1000 cases | `fast-check` with 1000 runs |
| security-tests | audit + license | `npm audit` + `license-checker` |
| stress-tests | serial execution | `vitest --runInBand` |
| lint | security-focused gates | ESLint with security rules |
| fmt | format check | `prettier --check` |

## Lint Gates (Security-Focused)

```
no-throw-literal
no-console (in production code)
@typescript-eslint/no-non-null-assertion
@typescript-eslint/no-explicit-any (warn)
```

## SECURITY.md Policy

- Private disclosure via GitHub Security Advisories
- 48h acknowledgment SLA
- 1 week assessment, 2 week fix for critical

## Acceptance Criteria

- [ ] Nightly security audit with auto-issue on failure
- [ ] Weekly fuzz testing on parsing entrypoints
- [ ] Security-focused lint gates in CI
- [ ] Separate CI jobs for unit, integration, security, stress
- [ ] SECURITY.md with disclosure policy
