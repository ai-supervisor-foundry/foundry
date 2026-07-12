# 04 — Implementation Steps & Risks

## Phase 1: Backend Foundation

- [ ] Create `UI/backend/src/middleware/webhookAuth.ts`
- [ ] Create `UI/backend/src/middleware/webhookRateLimit.ts`
- [ ] Create `UI/backend/src/services/webhookService.ts` (handlers, dedup, logging)
- [ ] Create `UI/backend/src/routes/webhooks.ts` (REST endpoints)
- [ ] Add `webhook_events` table migration
- [ ] Integrate into `UI/backend/src/app.ts` (raw body middleware, route mounting)
- [ ] Tests: auth, rate limit, dedup, task creation

## Phase 2: Frontend

- [ ] Create `UI/frontend/src/components/WebhookSettings.tsx`
- [ ] Create `UI/frontend/src/components/WebhookHistory.tsx`
- [ ] Create `UI/frontend/src/components/TestWebhookModal.tsx`
- [ ] Add "Webhooks" section to Settings page
- [ ] Add webhook badge to TaskCard
- [ ] Add webhook API methods to `api.ts`
- [ ] Tests: UI rendering, form submission, API calls

## Phase 3: Polish

- [ ] Audit logging for webhook events (already in webhook_events table)
- [ ] Documentation in supervisor-contexts/ (webhook setup guide)
- [ ] Example cURL commands for CI/CD pipelines
- [ ] Rate limit circuit breaker (optional: auto-pause webhooks if too many failures)

## Effort Estimate

| Component | Files | Complexity |
|-----------|-------|------------|
| Backend middleware | 2 | Low |
| Backend service | 3 | Low-Medium |
| Frontend | 4 | Low |
| **Total** | **9** | **Low** |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Malformed webhook payload crashes backend | Medium | Validate payload schema; return 400 on invalid |
| HMAC verification implementation bug | High | Use well-tested HMAC library; unit test extensively |
| Rate limit bypass via distributed requests | Medium | Track per-IP globally (Redis-backed for multi-process) |
| Duplicate task enqueue on fast re-sends | Low | Redis TTL dedup key prevents this |
| Webhook secret leaked | High | Instructions: use env vars, never log payloads, rotate secrets regularly |
| Large webhook payloads (many failed tests) | Low | Cap payload size at request level (e.g., 1MB) |
| Redis dedup keys expire while task still processing | Low | Use 24h TTL (much longer than typical task duration) |

## Testing

### Unit Tests
```
- HMAC signature verification (valid, invalid, missing)
- Bearer token verification (valid, invalid, missing)
- Rate limiting (per-IP, per-project, reset window)
- Test failure payload parsing and task creation
- Generic webhook payload parsing
- Deduplication logic
- Webhook event logging
```

### Integration Tests
```
- Full webhook flow: POST → auth → dedup check → enqueue → log
- Rate limit triggering and backoff
- Duplicate event handling
- Webhook config CRUD
- Test webhook endpoint
```

### E2E Tests (Cypress/Playwright)
```
- Settings page: configure webhooks, view history
- Send test webhook
- Regenerate secret
- Task appears with webhook badge
```

## Deployment Notes

1. **Secret Management**
   - Generate secrets via: `crypto.randomBytes(32).toString('hex')`
   - Store in environment variable or settings table (encrypted)
   - Provide UI to regenerate without downtime

2. **Rate Limit Persistence**
   - For single-process, in-memory Map is fine
   - For multi-process (pm2), use Redis for shared rate limit state

3. **Migration**
   - Add `webhook_events` table on first run
   - Webhook config defaults to disabled (operator must enable)

## Future Considerations

- **GitHub Native Webhook**: Leverage GitHub's push webhooks directly (requires app registration)
- **Slack Integration**: Slack slash command → enqueue task
- **Webhook Signature Verification**: Add signature header validation UI
- **Circuit Breaker**: Auto-disable webhook if N consecutive errors
- **Retry Logic**: Retry failed webhook deliveries (requires storing pending requests)
