# API Repo Orchestrator

## Inherits global contract

See the workspace root `.github/copilot-instructions.md` for shared rules.
See `shared/ARCHITECTURE.md` and `shared/types/api.ts` for the shared contract.

## Stack

- Runtime: Node.js + TypeScript strict mode
- Framework: Express 5
- Persistence: Prisma + PostgreSQL
- Validation: `express-validator` at the HTTP edge
- Auth: JWT + `bcryptjs`
- Observability: Morgan, Helmet, Sentry when configured
- Testing: Jest + Supertest

## Skill agents in this repo

| Task                               | Agent                     |
| ---------------------------------- | ------------------------- |
| Prisma schema and data modeling    | `schema.instructions.md`  |
| Routes, controllers, services      | `routes.instructions.md`  |
| JWT, password, and auth middleware | `auth.instructions.md`    |
| Jest and Supertest coverage        | `testing.instructions.md` |

## Orchestrator rules

- New resource flow: schema, service, controller, route, test.
- Keep route handlers thin and push business logic into services.
- Validate input before the service layer.
- Return `{ data }` for single payloads and `{ data, meta }` for list payloads.
- Keep all public routes under `/api/v1`.
