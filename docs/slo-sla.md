# SLO/SLA Contract — Inspect PH Platform

_Version 1.0 · Effective from first production deployment_

---

## 1. Scope

This document defines the Service Level Objectives (SLOs) and Service Level Agreement (SLA) commitments for the Inspect PH platform, covering:

- **API** — Node.js/Express service backed by PostgreSQL
- **Dashboard** — Next.js web application
- **Mobile app** — Expo/React Native application (device-side availability not covered)

---

## 2. Availability Targets

| Component                         | SLO                     | SLA (contractual floor) |
| --------------------------------- | ----------------------- | ----------------------- |
| API (`/api/v1/health`)            | 99.5 % monthly uptime   | 99.0 %                  |
| Dashboard (home page HTTP 200)    | 99.0 % monthly uptime   | 98.5 %                  |
| Database (Prisma connection pool) | Measured via API health | —                       |

**Uptime** = (total minutes in period − downtime minutes) / total minutes × 100.

**Downtime** = any calendar minute in which the health check returns a non-2xx response or times out for 3 consecutive probes.

### Planned maintenance windows

Planned maintenance does not count as downtime when:

1. Announced at least 24 hours in advance to affected LGU admins.
2. Scheduled outside 07:00–22:00 Philippine Standard Time (PST) on weekdays.
3. Does not exceed 4 hours per month in aggregate.

---

## 3. Performance Targets

| Metric                                                     | SLO                          |
| ---------------------------------------------------------- | ---------------------------- |
| API p95 response latency (read endpoints)                  | < 500 ms                     |
| API p95 response latency (write endpoints)                 | < 1 000 ms                   |
| Dashboard Time to First Byte (TTFB, server-rendered pages) | < 800 ms                     |
| Background job queue drain (inspection reminders)          | within 15 minutes of trigger |

Latency is measured at the load-balancer edge, excluding client network time.

---

## 4. Data Durability & Recovery

| Metric                         | Target                                                |
| ------------------------------ | ----------------------------------------------------- |
| Recovery Point Objective (RPO) | 1 hour (maximum data loss window)                     |
| Recovery Time Objective (RTO)  | 4 hours (time to restore service after major failure) |
| Database backup frequency      | Every 1 hour (continuous WAL archiving preferred)     |
| Backup retention               | 30 days                                               |
| Cross-region backup copy       | Required for production                               |

---

## 5. Degraded-Mode Contract

When the API is partially degraded (not fully down), the following minimum guarantees apply:

| Scenario                                             | Minimum behavior                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Database read-only (primary down, replica available) | Read-only mode; write endpoints return HTTP 503 with `{ error: { code: "READ_ONLY_MODE" } }`                                       |
| Payment provider unreachable                         | Payment initiation fails gracefully with `{ error: { code: "PAYMENT_PROVIDER_UNAVAILABLE" } }`; existing records remain accessible |
| Push notification service unreachable                | Notifications queued in `NotificationsOutbox`; no data loss                                                                        |
| Storage (S3/equivalent) unavailable                  | Attachment uploads queue locally on mobile; existing attachments inaccessible via presigned URLs return HTTP 503                   |

---

## 6. Error Budget

Monthly error budget is calculated as follows:

$$E_{\text{budget}} = (1 - \text{SLO}) \times T_{\text{month}}$$

For the API SLO of 99.5 %:

$$E_{\text{budget}} = 0.005 \times 43{,}200 \text{ min} = 216 \text{ min/month}$$

For the Dashboard SLO of 99.0 %:

$$E_{\text{budget}} = 0.01 \times 43{,}200 \text{ min} = 432 \text{ min/month}$$

When **> 50 % of the monthly error budget is consumed**, the engineering team must:

- Halt new feature deployments until root cause is resolved.
- Complete a reliability review before the next release.

When **100 % of the error budget is consumed**, an SLA breach is triggered and remediation credits apply (see §7).

---

## 7. SLA Breach Remediation

| Breach severity | Monthly uptime achieved | Remediation                    |
| --------------- | ----------------------- | ------------------------------ |
| Minor           | 98.0 %–99.0 % (API)     | 1-month service credit         |
| Major           | 95.0 %–98.0 %           | 3-month service credit         |
| Critical        | < 95.0 %                | Full contract review + credits |

Credits apply only when the breach is caused by platform-side failures, not by client-side misconfiguration, upstream internet outages, or force majeure.

---

## 8. Monitoring & Reporting

- Health check endpoint: `GET /api/v1/health` — must return HTTP 200 within 5 s.
- Uptime reports are generated monthly and shared with LGU stakeholders.
- Sentry error rate dashboards are reviewed weekly.
- Real-time alerting is configured for p95 latency exceeding 2× SLO threshold for 5 consecutive minutes.

---

## 9. Exclusions

The SLA does **not** cover:

- Device-side React Native app performance or crashes.
- Third-party payment provider (PayMongo) availability.
- DNS resolution failures outside the platform's control.
- Force majeure events (power outages, natural disasters, acts of war).

---

_Maintained by the Inspect PH engineering team. Next review: 6 months from effective date._
