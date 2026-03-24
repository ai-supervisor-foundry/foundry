# 04c — Secret Redaction & OWASP Compliance

## Source Files
- `tests/security/credential_leakage.rs` — Secret redaction tests
- `docs/compliance/owasp_llm_top10.md` — OWASP mitigations

## SecretString Class

```typescript
class SecretString {
  #value: string;
  constructor(value: string) { this.#value = value; }
  expose(): string { return this.#value; }
  toString(): string { return '***'; }
  toJSON(): string { return '***'; }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return 'SecretString(***)';
  }
}
```

Prevents accidental secret logging via `console.log`, `JSON.stringify`,
or `util.inspect`.

## Secret Detection Patterns

```typescript
const SECRET_PATTERNS = [
  /ANTHROPIC_API_KEY=\S+/g,
  /OPENAI_API_KEY=\S+/g,
  /GOOGLE_API_KEY=\S+/g,
  /sk-[a-zA-Z0-9-]{10,}/g,      // OpenAI keys
  /AKIA[A-Z0-9]{16}/g,          // AWS access keys
  /ghp_[a-zA-Z0-9]{36}/g,       // GitHub PATs
  /gho_[a-zA-Z0-9]{36}/g,       // GitHub OAuth
];

function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS)
    result = result.replace(pattern, '***REDACTED***');
  return result;
}
```

## Error Message Key Redaction

Show only first 4 + last 4 characters:

```typescript
function redactKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
```

## Checkpoint Exclusion Rule

Session state / checkpoint JSON must **never** contain raw `api_key`
or `secret` fields. Strip before serialization.

## "Lethal Trifecta" Check

Before any action, evaluate if ALL THREE exist simultaneously:
1. **Untrusted input** — external/user content in context
2. **Sensitive data access** — tool reading credentials/env/secrets
3. **Exfiltration vector** — network request, shell pipe, MCP call

If all three → require explicit human approval regardless of mode.

## OWASP LLM Top 10 Key Mitigations

| Risk | Mitigation |
|------|-----------|
| LLM01 Prompt Injection | XML delimiters around user content |
| LLM02 Insecure Output | Scan output for secrets before shell |
| LLM04 Model DoS | AbortController + timeout, token budget |
| LLM06 Sensitive Info | OS keyring (keytar), never plaintext |
| LLM08 Excessive Agency | Per-tool approval mode (ask/auto/deny) |

## Acceptance Criteria

- [ ] SecretString prevents accidental secret logging
- [ ] Secret patterns redacted from all logs and session state
- [ ] Error messages show redacted keys (first 4 + last 4)
- [ ] Checkpoints never contain raw credential fields
- [ ] Lethal trifecta check implemented for high-risk actions
- [ ] OWASP mitigations documented and implemented
