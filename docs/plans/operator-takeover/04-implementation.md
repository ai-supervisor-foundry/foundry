# 04 — Implementation Steps & Risks

## Phase 1: Backend Foundation

- [ ] Add `socket.io` to `UI/backend`
- [ ] Create `UI/backend/src/services/takeoverService.ts`
- [ ] Create `UI/backend/src/routes/takeover.ts` (REST endpoints)
- [ ] Mount takeover routes in `UI/backend/src/app.ts`
- [ ] Initialize socket.io server with HTTP server
- [ ] Tests: REST endpoints, session management

## Phase 2: Supervisor Integration

- [ ] Create `src/application/services/controlLoop/modules/takeoverHandler.ts`
- [ ] Integrate TakeoverHandler into control loop
- [ ] Implement command listener (KILL, RESUME, RERUN, COMPLETE, ABORT)
- [ ] Implement process kill logic (SIGTERM → SIGKILL fallback)
- [ ] Implement log capture (last N lines of agent output)
- [ ] Tests: each takeover action, edge cases

## Phase 3: Frontend

- [ ] Add `socket.io-client` to `UI/frontend`
- [ ] Create `useTakeover.ts` hook
- [ ] Create `TakeoverPanel.tsx`
- [ ] Create `TakeoverChat.tsx`
- [ ] Create `TakeoverActions.tsx`
- [ ] Integrate "Take Over" button into TaskCard
- [ ] Add takeover param handling to Dashboard
- [ ] Tests: UI rendering, WebSocket connection, message flow

## Phase 4: Polish

- [ ] Confirmation modal before killing process
- [ ] Error handling (process already dead, WebSocket timeout)
- [ ] Audit logging for takeover events
- [ ] Dashboard badge: "Takeover in progress"
- [ ] Documentation (supervisor-contexts/)

## Effort Estimate

| Component | Files | Complexity |
|-----------|-------|------------|
| Backend (core) | 4 | Medium |
| Supervisor integration | 1 | Medium |
| Frontend | 4 | Low-Medium |
| **Total** | **9** | **Medium** |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Process kill timing — child process already dead when SIGTERM sent | Low | Catch error, check `childProcess.killed` |
| WebSocket connection drops during takeover | Medium | Auto-reconnect in hook with message queue |
| Operator message appending loses context | Low | Store full conversation history in session |
| Execution logs not captured correctly | Low | Add fallback: log last state of task object if agent logs unavailable |
| Single-control-loop assumption breaks | High | Document assumption clearly; defer parallel support |
| Multiple takeovers on same task | Low | Reject in takeoverService if already active |

## Testing

### Unit Tests
```
- ProcessSuspender (if resurrection needed)
- TakeoverService: session CRUD, status transitions
- TakeoverHandler: kill, resume, rerun, complete, abort actions
- takeoverService: integration with task queue
```

### Integration Tests
```
- Takeover flow: request → kill → message → resume → resume execution
- Rerun flow: request → kill → rerun (re-enqueue) → new execution
- Complete flow: request → kill → complete
- Abort flow: request → kill → abort (blocked)
```

### E2E Tests (Cypress/Playwright)
```
- Click "Take Over" button on running task
- Confirm kill dialog
- Panel appears with execution logs
- Send message
- Click Resume
- Task resumes and completes
```

## Future Considerations

- **Parallel Scheduler**: Add "Select Worker" UI for multi-worker setups
- **Undo Takeover**: Allow reverting to pre-takeover state if operator wants to abort
- **Takeover Timeout**: Timeout takeover session after 30 min inactivity
- **Rich Editor**: Upgrade message input to support code snippets, file diffs
