# Functional Tests

Flow tests for boilerplate frontend. Tests use MSW-stubbed API (auth, users).

## Run

```bash
npm run test -- functional_tests/
```

## Structure

- `fixtures/mockObjects.ts` — Mock data (User only)
- `handlers/apiHandlers.ts` — MSW handlers (auth + users)
- `server.ts` — MSW server setup
- `setup.ts` — MSW lifecycle (listen/reset/close), imported by each test file
- `setup-global.ts` — jest-dom matchers, cleanup, ResizeObserver polyfill

## Test Files

| File | Coverage |
|------|----------|
| `auth.test.tsx` | Login (valid, invalid credentials) |
