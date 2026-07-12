# 01 — Webhooks: Overview

## Problem

Tasks enter the supervisor only through:
- **CLI** (`npm run cli -- enqueue ...`)
- **UI** (Dashboard → Add Task form)
- **Bulk enqueue** (JSON file)

There's no way for **external systems to automatically create tasks**. Use case: CI/CD pipeline detects failing tests and wants the supervisor to auto-create a fix task.

## Concept

**Webhooks** = HTTP endpoints that accept events from external systems and convert them into supervisor tasks.

```
[CI/CD Pipeline]  →  POST /api/webhooks/test-failure  →  [Enqueue fix task]
[GitHub Actions]  →  POST /api/webhooks/generic        →  [Enqueue task]
[Custom Script]   →  POST /api/webhooks/generic        →  [Enqueue task]
```

## Event Types

### 1. Test Failure Webhook (Primary)

When tests fail in CI/CD, send:

```json
POST /api/webhooks/test-failure
{
  "project_id": "easeclassifieds",
  "test_command": "npm test",
  "failed_tests": [
    {
      "name": "LoginForm.test.tsx > should validate email",
      "file": "src/components/__tests__/LoginForm.test.tsx",
      "error": "Expected: true, Received: false",
      "stack": "at Object.<anonymous> (LoginForm.test.tsx:42)"
    }
  ],
  "commit_sha": "abc123def456",
  "branch": "feature/login-fix",
  "ci_url": "https://github.com/org/repo/actions/runs/12345",
  "metadata": { "ci_provider": "github-actions" }
}
```

The webhook auto-creates a task:

```json
{
  "task_id": "webhook-test-fix-1711532400000",
  "project_id": "easeclassifieds",
  "source": "webhook:test-failure",
  "intent": "Fix failing tests: LoginForm.test.tsx > should validate email",
  "instructions": "The following tests are failing:\n\n1. `LoginForm.test.tsx > should validate email`\n   File: src/components/__tests__/LoginForm.test.tsx\n   Error: Expected: true, Received: false\n   Stack: at Object.<anonymous> (LoginForm.test.tsx:42)\n\nCommit: abc123def456\nBranch: feature/login-fix\nCI: https://github.com/org/repo/actions/runs/12345\n\nFix the failing tests. Do not change test expectations unless the test itself is wrong.",
  "acceptance_criteria": [
    "All previously failing tests now pass",
    "No new test failures introduced",
    "Test command `npm test` exits with code 0"
  ],
  "test_command": "npm test",
  "tests_required": true,
  "affects_files": ["src/components/__tests__/LoginForm.test.tsx"],
  "status": "pending",
  "metadata": {
    "source": "webhook:test-failure",
    "webhook_received_at": "2026-03-28T10:30:00Z",
    "idempotency_key": "webhook:test-failure:easeclassifieds:abc123def456",
    "ci_url": "https://github.com/org/repo/actions/runs/12345",
    "commit_sha": "abc123def456",
    "branch": "feature/login-fix"
  }
}
```

### 2. Generic Webhook

For any task-creation event:

```json
POST /api/webhooks/generic
{
  "project_id": "myproject",
  "intent": "Fix GitHub issue #42",
  "instructions": "User reported a bug with password reset. See issue link.",
  "acceptance_criteria": ["Password reset works", "Email is sent"],
  "priority": "normal",
  "metadata": {
    "source_system": "github",
    "issue_url": "https://github.com/org/repo/issues/42",
    "triggered_by": "user@example.com"
  }
}
```

## Security

### Authentication

**A. HMAC Signature** (recommended for CI/CD)

```
POST /api/webhooks/test-failure
X-Webhook-Signature: sha256=<hmac_of_body_with_secret>
```

Backend verifies: `HMAC-SHA256(body, secret) == signature`

**B. Bearer Token** (simpler, for trusted internal systems)

```
Authorization: Bearer <webhook_token>
```

### Rate Limiting

- **Per-IP**: Max 30 requests/minute (prevents runaway CI loops)
- **Per-project**: Max 10 tasks/hour from webhooks (prevents queue flooding)
- Configurable in settings

### Deduplication

Webhook events include an `idempotency_key` (or backend generates one from `commit_sha`):

```
idempotency_key = "webhook:test-failure:{project_id}:{commit_sha}"
```

Redis stores seen keys with 24-hour TTL. Duplicate events are acknowledged (200 OK) but not re-enqueued.

## Task Metadata

All webhook-created tasks carry metadata:

```json
{
  "source": "webhook:test-failure",           // Type of webhook
  "webhook_received_at": "2026-03-28T...",    // When webhook arrived
  "webhook_payload_hash": "sha256:...",       // Hash of payload (for audit)
  "idempotency_key": "webhook:test-failure:...", // Dedup key
  "ci_url": "https://..."                     // Link to CI run (for test-failure)
}
```

This allows:
- **Audit trail**: Which tasks came from webhooks vs manual
- **UI filtering**: Show webhook-sourced tasks separately
- **Deduplication**: Prevent duplicate enqueue

## Configuration

Stored in Postgres `settings` table:

```json
{
  "webhooks": {
    "enabled": true,
    "endpoints": {
      "test-failure": {
        "enabled": true,
        "secret": "whsec_...",
        "auth_method": "hmac",
        "rate_limit": { "per_minute": 30, "per_hour_per_project": 10 },
        "default_provider": "claude",
        "default_agent_mode": "opus-4.5"
      },
      "generic": {
        "enabled": true,
        "secret": "whsec_...",
        "auth_method": "bearer",
        "rate_limit": { "per_minute": 10 }
      }
    }
  }
}
```
