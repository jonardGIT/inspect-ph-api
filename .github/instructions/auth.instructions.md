---
applyTo: "src/**/*auth*,src/**/*token*,src/middleware/**,src/lib/**"
---

# Auth Agent

## Current stack

- JWT via `jsonwebtoken`
- Password hashing via `bcryptjs`
- Environment-driven secrets via `process.env`

## Token policy

- Access tokens must be signed with a server-side secret.
- Keep payloads minimal: subject, role, and short-lived claims only.
- Do not put sensitive profile data in tokens.
- Reject malformed or expired tokens with a 401 response.

## Password policy

- Hash passwords with `bcryptjs` using a strong cost factor.
- Never log passwords or password hashes.
- Compare using the library helpers only.

## Middleware rules

- Authentication middleware should parse the Bearer token and attach a safe user context.
- Authorization middleware should enforce role or capability checks separately from token parsing.
- Keep auth failures generic and avoid user-enumeration hints.

## Security rules

- Never return secrets, tokens, or hashes in API responses.
- Validate required auth env vars during startup.
- Prefer deny-by-default for protected routes.
