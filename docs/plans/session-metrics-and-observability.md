# Session Metrics & Observability

**Status:** Planned
**Source:** Extracted from `session-reuse-optimization.md` (Phase 3)
**Priority:** Medium
**Effort:** ~2 hours

## Context

The core Session Reuse and Agent Context Optimization has been implemented. However, the monitoring and observability layer (Phase 3 of the original plan) remains to be fully realized. While `AnalyticsService` collects some data, we lack a dedicated view for session reuse efficiency, token savings, and cache hit rates.

## Objectives

1.  **Dedicated Session Metrics:** Implement a specific collector for session lifecycle events (creation, reuse, expiry).
2.  **Observability Dashboard:** Create a mechanism (log-based or CLI output) to view session health and savings.
3.  **Validation Runbook:** Document how to verify session reuse is working effectively.

## Implementation Plan

### 1. Session Metrics Collector

Enhance `AnalyticsService` or create `SessionMetricsCollector` in `src/infrastructure/monitoring/sessionMetrics.ts` to track:

*   **Total Sessions Created:** New sessions spawned.
*   **Total Sessions Reused:** Times an existing session was successfully resumed.
*   **Reuse Rate:** `(Reused / (Created + Reused)) * 100`.
*   **Token Savings:** Estimated tokens saved via caching/reuse.
*   **Session Lifespan:** Average iterations per session.

### 2. Enhanced Logging

Update `src/application/services/controlLoop.ts` to log high-level session stats periodically (e.g., every 10 iterations):

```typescript
// Example Log Output
[Metrics] Session Reuse Rate: 78% | Avg Cache Hit: 42% | Est. Savings: 1.2M Tokens
```

### 3. Validation Runbook

Create a validation script or runbook commands to verify:

*   `-r` flag usage in logs.
*   "Resuming session" log entries.
*   Token cache values in provider responses.

## Success Criteria

*   [ ] Session reuse rate is observable via logs.
*   [ ] Token savings are quantified.
*   [ ] A "Session Health" report can be generated.
