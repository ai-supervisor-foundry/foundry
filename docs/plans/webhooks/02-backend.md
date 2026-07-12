# 02 — Webhooks Backend

## REST Routes

New file: `UI/backend/src/routes/webhooks.ts`

```
POST   /api/webhooks/test-failure    — Handle test failure events
POST   /api/webhooks/generic         — Handle generic task events
GET    /api/webhooks/config          — Get webhook configuration
POST   /api/webhooks/config          — Update webhook configuration
GET    /api/webhooks/history         — Get recent webhook event history (paginated)
POST   /api/webhooks/regenerate      — Regenerate webhook secret
```

## Middleware

### Authentication Middleware

```typescript
// UI/backend/src/middleware/webhookAuth.ts

export function webhookAuth(endpointName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const config = await getWebhookConfig(endpointName);

    if (!config || !config.enabled) {
      return res.status(404).json({ error: 'Webhook endpoint not found or disabled' });
    }

    if (config.auth_method === 'hmac') {
      const signature = req.headers['x-webhook-signature'] as string;
      if (!signature) {
        return res.status(401).json({ error: 'Missing X-Webhook-Signature header' });
      }

      const expectedSig = createHmac('sha256', config.secret)
        .update(req.rawBody) // Must preserve raw body
        .digest('hex');

      // Constant-time comparison
      if (!timingSafeEqual(signature, `sha256=${expectedSig}`)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } else if (config.auth_method === 'bearer') {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Authorization header' });
      }

      const token = auth.slice(7);
      if (token !== config.secret) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    next();
  };
}
```

### Rate Limit Middleware

```typescript
// UI/backend/src/middleware/webhookRateLimit.ts

const requestCounts: Map<string, { timestamps: number[] }> = new Map();
const projectCounts: Map<string, { count: number; resetAt: number }> = new Map();

export function webhookRateLimit(config: { perMinute: number; perHourPerProject: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const projectId = (req.body.project_id || req.query.project_id) as string;
    const now = Date.now();
    const windowMs = 60_000;
    const hourMs = 3600_000;

    // Per-IP rate limit
    const ipEntry = requestCounts.get(ip) || { timestamps: [] };
    ipEntry.timestamps = ipEntry.timestamps.filter(t => now - t < windowMs);

    if (ipEntry.timestamps.length >= config.perMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded (per IP)',
        retry_after_seconds: Math.ceil((ipEntry.timestamps[0] + windowMs - now) / 1000),
      });
    }

    ipEntry.timestamps.push(now);
    requestCounts.set(ip, ipEntry);

    // Per-project hourly limit
    if (projectId) {
      const projKey = `${projectId}`;
      const projEntry = projectCounts.get(projKey) || { count: 0, resetAt: now + hourMs };

      if (now > projEntry.resetAt) {
        projEntry.count = 0;
        projEntry.resetAt = now + hourMs;
      }

      if (projEntry.count >= config.perHourPerProject) {
        return res.status(429).json({
          error: 'Rate limit exceeded (per project per hour)',
          retry_after_seconds: Math.ceil((projEntry.resetAt - now) / 1000),
        });
      }

      projEntry.count += 1;
      projectCounts.set(projKey, projEntry);
    }

    next();
  };
}
```

### Raw Body Preservation

For HMAC verification, preserve raw body before JSON parsing:

```typescript
// In UI/backend/src/app.ts

// Webhook routes need raw body
app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body as Buffer;
  req.body = JSON.parse(req.body.toString());
  next();
});

// Mount webhook routes
app.use('/api/webhooks', webhookAuth('test-failure'), webhookRateLimit({ perMinute: 30, perHourPerProject: 10 }), webhookRoutes);
```

## Test Failure Handler

```typescript
// UI/backend/src/services/webhookService.ts

interface TestFailurePayload {
  project_id: string;
  test_command: string;
  failed_tests: Array<{
    name: string;
    file: string;
    error: string;
    stack?: string;
  }>;
  commit_sha?: string;
  branch?: string;
  ci_url?: string;
  metadata?: Record<string, unknown>;
}

export async function handleTestFailure(
  payload: TestFailurePayload
): Promise<{ taskId: string; enqueued: boolean; message?: string }> {
  // 1. Validate
  if (!payload.project_id || !payload.failed_tests?.length) {
    throw new Error('project_id and failed_tests are required');
  }

  // 2. Generate idempotency key
  const idempotencyKey = payload.commit_sha
    ? `webhook:test-failure:${payload.project_id}:${payload.commit_sha}`
    : `webhook:test-failure:${payload.project_id}:${Date.now()}`;

  // 3. Check deduplication
  const isDuplicate = await redisClient.get(`webhook:dedup:${idempotencyKey}`);
  if (isDuplicate) {
    return { taskId: isDuplicate, enqueued: false, message: 'Duplicate event — task already exists' };
  }

  // 4. Build task
  const taskId = `webhook-test-fix-${Date.now()}`;
  const failedTestsSummary = payload.failed_tests
    .map((t, i) => {
      let entry = `${i + 1}. \`${t.name}\`\n   File: ${t.file}\n   Error: ${t.error}`;
      if (t.stack) entry += `\n   Stack: ${t.stack}`;
      return entry;
    })
    .join('\n\n');

  const task: Task = {
    task_id: taskId,
    project_id: payload.project_id,
    source: 'webhook:test-failure',
    intent: `Fix failing tests: ${payload.failed_tests.map(t => t.name).join(', ').slice(0, 80)}...`,
    instructions: [
      'The following tests are failing:',
      '',
      failedTestsSummary,
      '',
      payload.commit_sha ? `Commit: ${payload.commit_sha}` : '',
      payload.branch ? `Branch: ${payload.branch}` : '',
      payload.ci_url ? `CI: ${payload.ci_url}` : '',
      '',
      'Fix the failing tests. Do not change test expectations unless the test itself is wrong.',
      `Run \`${payload.test_command}\` to verify all tests pass.`,
    ]
      .filter(Boolean)
      .join('\n'),
    acceptance_criteria: [
      'All previously failing tests now pass',
      'No new test failures introduced',
      `Test command \`${payload.test_command}\` exits with code 0`,
    ],
    test_command: payload.test_command,
    tests_required: true,
    affects_files: [...new Set(payload.failed_tests.map(t => t.file))],
    status: 'pending',
    metadata: {
      source: 'webhook:test-failure',
      webhook_received_at: new Date().toISOString(),
      webhook_payload_hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      idempotency_key: idempotencyKey,
      ci_url: payload.ci_url,
      commit_sha: payload.commit_sha,
      branch: payload.branch,
      ...(payload.metadata || {}),
    },
  };

  // 5. Enqueue task
  await enqueueTask(task);

  // 6. Record deduplication key (TTL: 24 hours)
  await redisClient.set(`webhook:dedup:${idempotencyKey}`, taskId, 'EX', 86400);

  // 7. Log webhook event
  await logWebhookEvent('test-failure', payload, taskId, 'processed');

  return { taskId, enqueued: true, message: 'Task enqueued successfully' };
}

export async function handleGenericWebhook(payload: any): Promise<{ taskId: string; enqueued: boolean; message?: string }> {
  // Similar pattern, simpler validation
  // Just requires: project_id, intent, instructions

  const taskId = `webhook-generic-${Date.now()}`;
  const idempotencyKey = payload.idempotency_key || `webhook:generic:${payload.project_id}:${taskId}`;

  const isDuplicate = await redisClient.get(`webhook:dedup:${idempotencyKey}`);
  if (isDuplicate) {
    return { taskId: isDuplicate, enqueued: false, message: 'Duplicate event' };
  }

  const task: Task = {
    task_id: taskId,
    project_id: payload.project_id,
    source: 'webhook:generic',
    intent: payload.intent,
    instructions: payload.instructions,
    acceptance_criteria: payload.acceptance_criteria || [],
    status: 'pending',
    metadata: {
      source: 'webhook:generic',
      webhook_received_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      ...(payload.metadata || {}),
    },
  };

  await enqueueTask(task);
  await redisClient.set(`webhook:dedup:${idempotencyKey}`, taskId, 'EX', 86400);
  await logWebhookEvent('generic', payload, taskId, 'processed');

  return { taskId, enqueued: true };
}
```

## Webhook Event Logging

Store in Postgres for audit trail:

```sql
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL, -- 'test-failure', 'generic'
  payload JSONB NOT NULL,
  task_id TEXT, -- NULL if dedup/error
  status TEXT NOT NULL DEFAULT 'processed', -- processed, duplicate, error, rate_limited
  error_message TEXT,
  ip_address TEXT,
  received_at TIMESTAMP DEFAULT NOW(),
  INDEX (endpoint, received_at),
  INDEX (task_id)
);
```

```typescript
async function logWebhookEvent(
  endpoint: string,
  payload: any,
  taskId: string | null,
  status: 'processed' | 'duplicate' | 'error' | 'rate_limited',
  errorMessage?: string
): Promise<void> {
  await db.query(
    `INSERT INTO webhook_events (endpoint, payload, task_id, status, error_message, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [endpoint, JSON.stringify(payload), taskId, status, errorMessage, '0.0.0.0']
  );
}
```

## Files to Create/Modify

| File | Change |
|------|--------|
| New: `UI/backend/src/routes/webhooks.ts` | Webhook endpoints |
| New: `UI/backend/src/services/webhookService.ts` | Event handlers, task creation, dedup |
| New: `UI/backend/src/middleware/webhookAuth.ts` | HMAC/Bearer auth |
| New: `UI/backend/src/middleware/webhookRateLimit.ts` | Rate limiting |
| `UI/backend/src/app.ts` | Mount webhook routes, raw body middleware |
| `UI/backend/src/db.ts` | Add `webhook_events` table migration |
| `UI/backend/package.json` | (No new dependencies needed) |

## Dependencies

Uses existing: `ioredis`, `express`, `pg`

No new dependencies required.
