# Incident Response Runbook — Inspect PH Platform

_Version 1.0 · Owned by the Engineering Lead_

---

## 1. Severity Matrix

| Severity          | Definition                                          | Response SLA                                      | Examples                                                                             |
| ----------------- | --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **P1 — Critical** | Complete service outage or data loss in progress    | Acknowledge in 15 min; resolve or mitigate in 4 h | API down, DB unreachable, data corruption detected                                   |
| **P2 — High**     | Core workflow broken for all users or data at risk  | Acknowledge in 30 min; resolve in 8 h             | Login failures for all LGUs, payment processing broken, all inspections inaccessible |
| **P3 — Medium**   | Significant degradation affecting a subset of users | Acknowledge in 2 h; resolve in 24 h               | Slow API (>2× SLO), push notifications failing, one LGU's data inaccessible          |
| **P4 — Low**      | Minor issue; workaround exists                      | Acknowledge in 1 business day; resolve in 1 week  | UI glitch, non-critical background job delayed, non-blocking error in logs           |

---

## 2. On-Call Rotation

| Role                       | Coverage                      |
| -------------------------- | ----------------------------- |
| Primary on-call engineer   | Weekdays 08:00–22:00 PST      |
| Secondary on-call engineer | Weekends and off-hours backup |
| Engineering Lead           | Escalation for P1/P2 events   |

> **Template — fill in before going to production:**
>
> | Rotation         | Name  | Contact          |
> | ---------------- | ----- | ---------------- |
> | Primary          | _TBD_ | _phone / Signal_ |
> | Secondary        | _TBD_ | _phone / Signal_ |
> | Engineering Lead | _TBD_ | _phone / email_  |

Rotation schedule managed via [PagerDuty / Opsgenie / internal tool — insert link].

---

## 3. Incident Response Steps

### 3.1 Detection

Incidents may be detected via:

- Automated alerting (Sentry, uptime monitor, log anomaly)
- LGU admin report (in-app feedback or direct message)
- Proactive health-check failure notification

### 3.2 Triage (< 15 min for P1/P2)

1. Confirm the incident is real (check `GET /api/v1/health` and Sentry).
2. Assign a **Severity** using §1.
3. Assign an **Incident Commander** (IC) — default: primary on-call.
4. Open an incident channel (e.g. `#incident-YYYYMMDD-short-desc` in Slack/Teams).
5. Post initial status to the internal status page.

### 3.3 Investigation

Useful diagnostic commands:

```bash
# Check recent API error rate
# (Sentry dashboard → API project → Error rate last 1h)

# Check DB connection
psql "$DATABASE_URL" -c "SELECT 1;"

# Tail API logs (if deployed to a container platform)
docker logs inspect-ph-api --tail 200 --follow

# Check pending background jobs
psql "$DATABASE_URL" -c \
  "SELECT COUNT(*) FROM \"NotificationsOutbox\" WHERE \"sentAt\" IS NULL AND \"failedAt\" IS NULL;"
```

### 3.4 Mitigation

Common mitigations:

| Symptom                          | First action                                                           |
| -------------------------------- | ---------------------------------------------------------------------- |
| API returns 5xx for all requests | Restart API container; check DB connection string                      |
| Database unresponsive            | Fail over to read replica; page DBA                                    |
| High memory / OOM                | Restart API pod; review recent deployments for memory leak             |
| Sentry spike from one endpoint   | Feature-flag the endpoint off or deploy hotfix                         |
| Payment webhook loop             | Block the IP at the load balancer; check `ProcessedWebhookEvent` table |
| Mobile push notifications stuck  | Check `NotificationsOutbox` queue; verify Expo push token validity     |

### 3.5 Resolution

1. Confirm service restored via health check and Sentry error rate back to baseline.
2. Update incident channel with "RESOLVED" and time-to-resolve.
3. Update internal status page.
4. Notify affected LGU admins (see §5 for template).

### 3.6 Post-Incident Review (PIR)

Required for all P1 and P2 incidents. Recommended for P3.

- Schedule PIR within **48 hours** of resolution.
- Use the postmortem template in §4.
- Share outcome with engineering team and, for P1/P2, with LGU stakeholders.

---

## 4. Postmortem Template

```
## Incident: [Short title]

**Date:** YYYY-MM-DD
**Severity:** P[1–4]
**Duration:** HH:MM (detection → resolution)
**IC:** [Name]

---

### Summary
One paragraph describing what happened and the business impact.

### Timeline
| Time (PST) | Event |
|------------|-------|
| HH:MM | Incident detected |
| HH:MM | IC assigned |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Service restored |

### Root Cause
Technical description of the root cause.

### Contributing Factors
- Factor 1
- Factor 2

### What went well
- …

### What went poorly
- …

### Action Items
| Action | Owner | Due date |
|--------|-------|----------|
| … | … | … |
```

---

## 5. Customer Communications Templates

### Initial acknowledgment (send within 30 min of P1/P2 detection)

> **Subject:** [Inspect PH] Service Disruption — [Date]
>
> Dear LGU Administrator,
>
> We are aware of an issue affecting [describe scope, e.g. "access to the Inspect PH platform"]. Our engineering team is actively investigating and working to restore service.
>
> We will provide an update within **[1 hour]**.
>
> We apologise for any inconvenience.
>
> — Inspect PH Engineering Team

### Resolution notification

> **Subject:** [Inspect PH] Service Restored — [Date]
>
> Dear LGU Administrator,
>
> The service disruption affecting [describe scope] has been resolved as of **[time PST]**.
>
> **Impact:** [Brief description of what was affected and for how long]
>
> **Next steps:** [Any action required by LGU admins, if any]
>
> We are conducting a post-incident review to prevent recurrence. A summary will be shared within 5 business days.
>
> — Inspect PH Engineering Team

---

## 6. Escalation Path

```
Primary on-call
    ↓ (no response in 15 min for P1, 30 min for P2)
Secondary on-call
    ↓ (no response in 15 min)
Engineering Lead
    ↓ (for P1 exceeding 2h unresolved)
Project/Product Owner
```

---

## 7. Key System Links

> Fill in before going to production:

| Resource                | URL / Location                          |
| ----------------------- | --------------------------------------- |
| API health check        | `https://[api-domain]/api/v1/health`    |
| Sentry (API)            | _insert link_                           |
| Sentry (Dashboard)      | _insert link_                           |
| Uptime monitor          | _insert link_                           |
| Database (read replica) | _insert connection string reference_    |
| Internal status page    | _insert link_                           |
| Incident channel        | `#incidents` in [Slack/Teams workspace] |

---

_Maintained by the Engineering Lead. Review this runbook after every P1/P2 postmortem._
