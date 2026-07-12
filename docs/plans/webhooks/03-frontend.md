# 03 — Webhooks Frontend UI

## Location

New section in **Settings page**: "Webhooks" (alongside General, Strategies, Execution Modes).

Route: `/settings?section=webhooks`

## Configuration Panel

```
┌─────────────────────────────────────────────────────┐
│  Webhooks Configuration                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Global Status: [Enabled ●]  [Disabled ○]            │
│                                                      │
│  ── Test Failure Endpoint ──────────────────────────│
│                                                      │
│  Status: [Enabled ●]                                 │
│  URL: http://localhost:3001/api/webhooks/test-failure│
│       [Copy URL]                                     │
│                                                      │
│  Auth Method: [HMAC Signature ●] [Bearer Token ○]    │
│  Secret:                                             │
│    whsec_••••••••••••••••••••••••••  [Show]           │
│    [Regenerate]  [Copy Secret]                       │
│                                                      │
│  Rate Limiting:                                      │
│    Per IP: [30] requests/minute                      │
│    Per Project: [10] tasks/hour                      │
│                                                      │
│  Default Provider: [claude ▼]                        │
│  Default Mode: [opus-4.5 ▼]                          │
│                                                      │
│  [Test Webhook] [Copy cURL]                          │
│                                                      │
│  ── Generic Endpoint ───────────────────────────────│
│                                                      │
│  Status: [Enabled ●]                                 │
│  URL: http://localhost:3001/api/webhooks/generic     │
│       [Copy URL]                                     │
│                                                      │
│  Auth Method: [HMAC Signature ○] [Bearer Token ●]    │
│  Secret: whsec_••••••••••••••••••••••••••  [Show]     │
│          [Regenerate]  [Copy Secret]                 │
│                                                      │
│  Rate Limiting:                                      │
│    Per IP: [10] requests/minute                      │
│                                                      │
│  [Test Webhook] [Copy cURL]                          │
│                                                      │
│  ── Recent Events ──────────────────────────────────│
│  [Test Webhook]                                      │
│                                                      │
│  ┌────────┬────────────┬──────┬──────────┬──────────┐│
│  │ Time   │ Endpoint   │ Proj │ Status   │ Task ID  ││
│  ├────────┼────────────┼──────┼──────────┼──────────┤│
│  │ 2m ago │ test-fail  │ proj │ ✓ OK     │ webhook- ││
│  │ 5m ago │ test-fail  │ proj │ ● DUP    │ —        ││
│  │ 1h ago │ generic    │ proj │ ✓ OK     │ webhook- ││
│  │ Error  │ test-fail  │ proj │ ✕ Error  │ —        ││
│  └────────┴────────────┴──────┴──────────┴──────────┘│
│  [Load More]                                         │
│                                                      │
│  [Save Changes]  [Cancel]                            │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. `WebhookSettings.tsx`

Main settings panel:
- Global enable/disable toggle
- Endpoint configuration cards (test-failure, generic)
- Secret management (show/hide/regenerate)
- Rate limit inputs
- Test webhook sender
- cURL command generator (for copying to CI config)

```typescript
// UI/frontend/src/components/WebhookSettings.tsx

interface WebhookSettingsProps {
  onSave: (config: WebhookConfig) => Promise<void>;
}

// State: config, loading, saved, error
```

### 2. `WebhookHistory.tsx`

Event history table:
- Timestamp, endpoint, project, status (processed/duplicate/error/rate_limited)
- Task ID link (if available)
- Filter by endpoint, status
- Pagination
- Auto-refresh

```typescript
// UI/frontend/src/components/WebhookHistory.tsx

interface WebhookEvent {
  id: number;
  endpoint: string;
  projectId: string;
  status: 'processed' | 'duplicate' | 'error' | 'rate_limited';
  taskId?: string;
  errorMessage?: string;
  receivedAt: string;
}
```

### 3. Integration with Tasks Page

Tasks sourced from webhooks show a badge:

```
┌─────────────────────────────────────────┐
│ 🔗 webhook:test-failure                 │
│ Task: webhook-test-fix-...              │
│ Intent: Fix failing tests                │
│ Source: CI (github-actions)              │
│ [View CI Run →]                          │
└─────────────────────────────────────────┘
```

### 4. Test Webhook Modal

```typescript
// UI/frontend/src/components/TestWebhookModal.tsx

interface TestWebhookModalProps {
  endpoint: 'test-failure' | 'generic';
  onClose: () => void;
}

// Pre-filled test payload
// Option to edit and send
// Shows response
```

## API Client Additions

```typescript
// UI/frontend/src/services/api.ts

export const webhookAPI = {
  getConfig: () => api.get('/api/webhooks/config'),
  saveConfig: (config: WebhookConfig) => api.post('/api/webhooks/config', config),
  getHistory: (limit: number = 50, offset: number = 0) =>
    api.get('/api/webhooks/history', { params: { limit, offset } }),
  testWebhook: (endpoint: string, payload: any) =>
    api.post(`/api/webhooks/${endpoint}`, payload),
  regenerateSecret: (endpoint: string) =>
    api.post('/api/webhooks/regenerate', { endpoint }),
};
```

## Files to Create/Modify

| File | Change |
|------|--------|
| New: `UI/frontend/src/components/WebhookSettings.tsx` | Config panel |
| New: `UI/frontend/src/components/WebhookHistory.tsx` | Event history table |
| New: `UI/frontend/src/components/TestWebhookModal.tsx` | Test webhook dialog |
| `UI/frontend/src/pages/Settings.tsx` | Add "Webhooks" section to sidebar |
| `UI/frontend/src/components/TaskCard.tsx` | Show webhook badge + CI link |
| `UI/frontend/src/services/api.ts` | Add webhook API methods |

## Styling

- Settings cards: `rounded-xl border border-gray-200 shadow-sm`
- Secret display: monospace font, `font-mono text-sm text-gray-600`
- Status badges:
  - Processed: `bg-green-50 text-green-700`
  - Duplicate: `bg-yellow-50 text-yellow-700`
  - Error: `bg-red-50 text-red-700`
  - Rate Limited: `bg-orange-50 text-orange-700`
- Buttons: Follow existing indigo theme
