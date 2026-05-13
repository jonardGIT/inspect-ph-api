---
applyTo: "prisma/**,src/**/*.schema.ts,src/schemas/**"
---

# Schema Agent

## Current stack

- Prisma is the source of truth for persistence models.
- The repo currently uses TypeScript interfaces and `express-validator` rather than a dedicated schema package.
- Keep shared response contracts aligned with `shared/types/api.ts`.

## Prisma conventions

- Primary keys should be UUID strings unless there is a strong reason otherwise.
- Add `createdAt` and `updatedAt` timestamps on user-facing models.
- Add indexes for foreign keys and common lookup fields.
- Keep field names stable when they are exposed through the API.
- After schema changes: run `npm run prisma:migrate` and `npm run prisma:generate`.

## Output shaping

- Do not leak raw Prisma entities directly when fields need hiding or renaming.
- Create explicit mapping functions for public response shapes.
- Keep database-only fields out of API payloads.

## When adding a new model

1. Update `prisma/schema.prisma`.
2. Run a descriptive Prisma migration.
3. Add or update response mappers and TypeScript types.
4. Notify the routes agent to add HTTP support.
5. Add or update tests that cover persistence behavior.
