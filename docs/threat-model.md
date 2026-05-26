# Threat Model — Inspect PH API

**Date:** May 2026  
**Scope:** API, Dashboard, Mobile (Expo)  
**Methodology:** STRIDE per component

---

## 1. Assets

| Asset                                 | Sensitivity | Notes                                   |
| ------------------------------------- | ----------- | --------------------------------------- |
| Inspector credentials (JWT)           | Critical    | Used for all field operations           |
| Business owner / citizen credentials  | High        | Access to permits, findings, payments   |
| Payment records (PayMongo webhooks)   | Critical    | HMAC-signed; financial integrity        |
| Inspection findings and photos        | High        | Regulatory evidence                     |
| FSIC certificates                     | High        | Forgery changes enforcement outcomes    |
| Audit logs                            | High        | Immutable chain; required for COA audit |
| PII (names, addresses, business data) | High        | RA 10173 scope                          |
| DataSubjectRequest contents           | Critical    | Legally-triggered access/erasure        |

---

## 2. Trust Boundaries

```
[Mobile (untrusted device)]
       |  HTTPS + JWT
[API (Express 5, Node)]  ←→  [PostgreSQL (internal)]
       |                          ↑
[Dashboard (Next.js SSR)]   [Prisma migrations]
       |  HTTPS + JWT
[Admin Browser (untrusted)]
       |
[PayMongo (external webhook)]
```

---

## 3. Attacker Personas

| Persona                       | Goal                                                                 | Entry Point                                                |
| ----------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Disgruntled inspector**     | Alter findings to harm a business or cover a mistake                 | Mobile JWT; direct API                                     |
| **Corrupt office clerk**      | Approve permits without inspection, delete records                   | Dashboard API calls                                        |
| **Fraudulent business owner** | Dismiss findings, inflate compliance score, accelerate cert issuance | Owner portal `/api/v1/permits/mine`, reinspection endpoint |
| **Scraping competitor**       | Harvest business names, permit numbers, fee amounts                  | Public permit lookup, issue-report endpoint                |
| **Hostile LGU**               | Access another LGU's data after login with stolen admin JWT          | Scoped resource endpoints                                  |
| **External attacker**         | Account takeover via credential stuffing; SQL injection              | `/auth/login`, `express-validator` inputs                  |
| **Webhook spoofer**           | Forge a PayMongo PAID event to zero-out an unpaid fee                | `/payments/webhooks`                                       |

---

## 4. STRIDE Analysis

### 4.1 Authentication (`/auth/login`, `/auth/register`, JWT issuance)

| Threat                            | STRIDE          | Risk     | Mitigation                                                    | Status         |
| --------------------------------- | --------------- | -------- | ------------------------------------------------------------- | -------------- |
| Credential brute-force            | Spoofing        | High     | `rateLimit` 10 req/15 min on login                            | ✅ Implemented |
| Weak JWT secret                   | Spoofing        | High     | Env-var `JWT_SECRET` required at startup; min length enforced | ✅ Implemented |
| JWT replay after logout           | Spoofing        | Medium   | Short-lived access tokens (15 min); refresh token rotation    | ✅ Implemented |
| JWT secret in logs                | Info disclosure | Medium   | Morgan configured to exclude `Authorization` header           | ✅ Implemented |
| Registration spam (citizen/owner) | DoS             | Medium   | `rateLimit` 5 req/15 min on `/auth/register`                  | ✅ Implemented |
| Password stored in plain text     | Info disclosure | Critical | `bcryptjs` rounds=12                                          | ✅ Implemented |

### 4.2 Inspection resources (`/inspections/*`)

| Threat                                      | STRIDE                     | Risk   | Mitigation                                                                  | Status         |
| ------------------------------------------- | -------------------------- | ------ | --------------------------------------------------------------------------- | -------------- |
| Inspector reads another LGU's inspections   | Spoofing / Info disclosure | High   | `requireJurisdiction()` enforces `accessScope` on every query               | ✅ Implemented |
| Inspector modifies a finding they don't own | Tampering                  | High   | `inspectorId` ownership check in `updateFinding()`                          | ✅ Implemented |
| Bulk create 10 000 inspections (DoS)        | DoS                        | Medium | `POST /inspections/bulk` capped at 50 items; validated by express-validator | ✅ Implemented |
| Finding GPS coordinates forged              | Tampering                  | Low    | GPS is advisory; actual enforcement uses checklist item results             | Accepted       |
| Checklist result tampered after completion  | Tampering                  | High   | `templateSnapshot` captured at creation; immutable after `COMPLETED`        | ✅ Implemented |

### 4.3 Payment webhook (`POST /payments/webhooks`)

| Threat                             | STRIDE                | Risk     | Mitigation                                                                  | Status         |
| ---------------------------------- | --------------------- | -------- | --------------------------------------------------------------------------- | -------------- |
| Forged PAID event without HMAC     | Tampering / Elevation | Critical | `timingSafeEqual` HMAC-SHA256 verification before any DB write              | ✅ Implemented |
| HMAC secret leaked via env dump    | Info disclosure       | High     | Secret loaded from `PAYMONGO_WEBHOOK_SECRET` env-var only; not logged       | ✅ Implemented |
| Replay of valid webhook body       | Tampering             | Medium   | PayMongo events carry a unique `id`; recommend idempotency key dedup (TODO) | ⚠️ Partial     |
| Webhook endpoint DoS (high volume) | DoS                   | Medium   | `publicPaymentRateLimiter` on webhook route                                 | ✅ Implemented |

**TODO (webhook replay):** Store processed PayMongo event IDs in a short-lived Redis/DB set and reject duplicates within a 24-hour window.

### 4.4 Attachment upload (`POST /inspections/:id/attachments/intent`)

| Threat                                           | STRIDE                | Risk   | Mitigation                                                                         | Status         |
| ------------------------------------------------ | --------------------- | ------ | ---------------------------------------------------------------------------------- | -------------- |
| Upload arbitrary content type (server-side exec) | Tampering / Elevation | High   | `mimeType` validated against allowlist in upload intent; storage provider enforces | ✅ Implemented |
| EXIF metadata leaks inspector location           | Info disclosure       | Medium | Dashboard strips EXIF on browser; mobile does not strip EXIF server-side           | ⚠️ Partial     |
| Attachment access without auth                   | Info disclosure       | High   | Download intents are time-limited signed URLs; no public direct access             | ✅ Implemented |
| Path traversal via `fileName`                    | Tampering             | High   | `fileName` sanitized to basename only; no path chars allowed                       | ✅ Implemented |

**TODO (EXIF stripping):** Strip EXIF from images at the API layer (via `sharp` or equivalent) before storing to prevent inspector GPS coordinates from being embedded in stored files.

### 4.5 Public endpoints (permit lookup, issue-report submission, certificate verify)

| Threat                                      | STRIDE          | Risk   | Mitigation                                                                                                              | Status         |
| ------------------------------------------- | --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- | -------------- |
| Scrape all permit numbers via permit lookup | Info disclosure | Medium | Rate limit 30 req/min; response returns only public fields                                                              | ✅ Implemented |
| Issue report spam                           | DoS             | Medium | `publicIssueReportRateLimiter` on public submit                                                                         | ✅ Implemented |
| Certificate number enumeration              | Info disclosure | Low    | Certificate numbers are non-sequential (`FSIC-{year}-{officeCode}-{seq}`); verify endpoint returns only boolean + dates | ✅ Implemented |
| XSS via `description` field in issue report | XSS             | Medium | All outputs are JSON (no HTML interpolation); dashboard uses React (auto-escapes)                                       | ✅ Implemented |

### 4.6 Admin operations (LGU/office management, user creation)

| Threat                                              | STRIDE    | Risk     | Mitigation                                                      | Status         |
| --------------------------------------------------- | --------- | -------- | --------------------------------------------------------------- | -------------- |
| Office clerk escalates to admin role                | Elevation | Critical | `role` is set only by `admin`; no self-update role endpoint     | ✅ Implemented |
| Cross-LGU data access with stolen `lgu_admin` token | Spoofing  | High     | `requireJurisdiction()` scopes all queries to `lguIds` from JWT | ✅ Implemented |
| Audit log deletion                                  | Tampering | High     | No delete endpoint for `AuditLog`; only `admin` read            | ✅ Implemented |
| SQL injection via query params                      | Injection | High     | All queries use Prisma parameterized queries; no raw SQL        | ✅ Implemented |

### 4.7 Data subject requests (`/privacy/requests`)

| Threat                                       | STRIDE          | Risk     | Mitigation                                                                    | Status         |
| -------------------------------------------- | --------------- | -------- | ----------------------------------------------------------------------------- | -------------- |
| GDPR erasure request accepted for wrong user | Tampering       | Critical | Admin must confirm erasure; `completedAt` written on explicit status update   | ✅ Implemented |
| DSR submission spam                          | DoS             | Medium   | `createRateLimitMiddleware` 10 req/15 min on public submit                    | ✅ Implemented |
| DSR contents readable by non-admin           | Info disclosure | High     | `GET /privacy/requests` and `GET /privacy/requests/:id` require `ADMIN_ROLES` | ✅ Implemented |

---

## 5. Abuse Cases

| ID    | Scenario                                                         | Detection Signal                                                                 | Response                                                                       |
| ----- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| AC-01 | Inspector fabricates GPS coordinates for a finding               | Location accuracy > 100 m or location matches office (not field)                 | Flag in supervisor dashboard; require photo evidence for low-accuracy findings |
| AC-02 | Clerk approves permit with status sweep bypass                   | `permit.status_updated` without corresponding `inspection.completed` audit event | Alert rule on audit log stream                                                 |
| AC-03 | Business owner requests reinspection repeatedly to delay closure | > 3 reinspection requests on same permit within 30 days                          | Auto-escalate to supervisor; block further requests                            |
| AC-04 | Credential stuffing via login endpoint                           | > 5 failed logins per IP per 15 min                                              | Already rate-limited; consider account lockout after 10 failures               |
| AC-05 | Webhook replay attack (duplicate PAID events)                    | Same PayMongo event ID processed twice                                           | Idempotency key storage (see Section 4.3 TODO)                                 |

---

## 6. Residual Risks and TODOs

| ID   | Risk                                                                                                 | Priority | Owner              | Status                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Webhook replay (no idempotency key dedup)                                                            | High     | API                | ✅ Resolved — `ProcessedWebhookEvent` idempotency store added (Pass 27)                                                                                 |
| R-02 | EXIF metadata not stripped server-side                                                               | Medium   | API                | ✅ Resolved — `sharp` strips EXIF before local storage write (Pass 28)                                                                                  |
| R-03 | No account lockout after repeated failed logins                                                      | Medium   | API                | ✅ Resolved — 10-attempt lockout with 15-min window (Pass 27)                                                                                           |
| R-04 | JWT refresh tokens not rotated on each use (single-rotation)                                         | Medium   | API                | ✅ Resolved — reuse detection added to `assertRefreshSessionActive`; stale hash on active session triggers immediate revocation (Pass 28)               |
| R-05 | Mobile app does not certificate-pin API TLS                                                          | Low      | Mobile             | ⚠️ Scaffolded — `lib/tls-pinning.ts` documents integration steps and cert-hash rotation procedure; activation requires production cert hash + EAS build |
| R-06 | No Content Security Policy on dashboard HTML responses                                               | Low      | Dashboard          | ✅ Resolved — CSP + X-Frame-Options + X-Content-Type-Options headers added in `next.config.ts` (Pass 28)                                                |
| R-07 | Sentry DSN exposed to client bundle (acceptable for error reporting; ensure no PII in error context) | Low      | Dashboard / Mobile | ✅ Resolved — `beforeSend` hooks in all three Sentry configs scrub PII fields and strip user email/name before ingestion (Pass 28)                      |

---

## 7. Out of Scope

- PhilSys / BIR integrations (not yet implemented)
- LGU network infrastructure
- Supabase storage bucket ACL (managed externally)
- End-to-end Playwright / Detox attack simulations (planned for Phase J)
