---
id: Y04
status: done
depends_on: [Y03]
---

# Y04 — Verify

## Checks

```bash
# Prefer --no-ignore if .gitignore hides CRG paths during verify
rg --no-ignore -i 'FOUNDRY_CRG|codeReviewGraph|CodeReviewGraph|/api/crg|CrgDashboard|graph_context|\bcrg\b' \
  src UI scripts tests package.json docker-compose.yml .env.example README.md \
  supervisor-contexts CLAUDE.md UI/CLAUDE.md AGENTS.md
```

Expect: no matches (or only intentional historical notes outside those roots). `\bcrg\b` catches `crg-home`, `crg:install`, etc.

```bash
rg -n 'resolveTaskSandboxCwd|gitContext|sessionMetrics' src --glob '*.ts' | head
# must still hit
```

Run targeted tests (adjust to what remains):

```bash
npm test -- --testPathPattern='promptBuilder|taskExecutor|gitContext|sessionMetrics|claudeCLI|cursorCLI'
```

## Acceptance

- Zero CRG product surface in runtime paths
- Keep-list still present
- Operator signs off; move this plan to `docs/plans/done/crg-yagni-removal/` when complete
