---
applyTo: "src/routes/**,src/controllers/**,src/services/**,src/app.ts,src/server.ts"
---

# Routes Agent

## Structure

- `src/routes/*` owns router registration and request validation.
- `src/controllers/*` owns HTTP concerns if controllers are introduced.
- `src/services/*` owns business logic and persistence calls.
- Keep `src/app.ts` focused on app wiring and middleware.

## Route conventions

- Prefix routes with `/api/v1`.
- Use `express-validator` for request validation.
- Return JSON in the shared `{ data }` or `{ data, meta }` shape.
- Forward unexpected failures to centralized error handling.

## Controller and service rules

- Controllers should parse input, call a service, and shape the response.
- Services should contain business logic and Prisma access.
- Avoid embedding persistence logic in route modules.
- Keep route modules small and resource-focused.

## Response rules

- Single resource: `res.json({ data: result })`
- Lists: `res.json({ data: items, meta: { total, page, limit } })`
- Created resources: `res.status(201).json({ data: result })`
- Empty deletes: `res.status(204).send()`
