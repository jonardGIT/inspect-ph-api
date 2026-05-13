---
applyTo: "src/__tests__/**,**/*.test.ts,**/*.spec.ts"
---

# Testing Agent

## Stack

- Test runner: Jest
- HTTP assertions: Supertest
- TypeScript transform: `ts-jest`

## Test structure

- Prefer one describe block per route or service.
- Name tests by behavior and condition.
- Follow arrange, act, assert.
- Keep request-level tests focused on observable behavior.

## Coverage expectations

- Every new route should include at least one success test.
- Validation failures should be covered when request validation exists.
- Auth-protected routes should include unauthorized cases.
- Service logic with branches should have both happy-path and failure-path tests.

## File placement

- API integration tests can live in `src/__tests__`.
- Keep test helpers in `src/__tests__/setup.ts` when shared setup is needed.
