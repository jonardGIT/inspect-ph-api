# Manual Role Scenario Checklist

This document is the manual QA sheet for the seeded Riverside Food Hub scenario.

Seed command:

```bash
cd /home/nhad/inspect-ph/inspect-ph-api
npm run seed:dev-role-scenario
```

All seeded users use the same password:

```text
password123
```

## Scenario summary

LGU:

- Code: `SCN-TUG`
- Name: `Tuguegarao City Scenario LGU`

Office:

- Code: `BPLO-RFH`
- Name: `BPLO Riverside Scenario Office`

Business:

- Name: `Riverside Food Hub`
- Permit number: `SCN-TUG-2026-0001`
- Payment reference: `SCN-PAY-2026-0001`
- Issue report: `IR-SCN-TUG-0001`
- Certificate number: `FSIC-SCN-TUG-2026-0001`

Inspections:

- Initial failed inspection: `00000000-0007-4000-8a11-000000009101`
- Follow-up passed inspection: `00000000-0007-4000-8a11-000000009102`
- Upcoming scheduled inspection: `00000000-0007-4000-8a11-000000009103`

Privacy request:

- ID: `00000000-0012-4000-8a11-000000009101`

## Accounts

| Role              | Email                                |
| ----------------- | ------------------------------------ |
| Admin             | `admin-role-scenario@inspectph.dev`  |
| LGU admin         | `lgu-admin-riverside@inspectph.dev`  |
| Office supervisor | `supervisor-riverside@inspectph.dev` |
| Office clerk      | `clerk-riverside@inspectph.dev`      |
| Inspector         | `inspector-riverside@inspectph.dev`  |
| Business owner    | `owner-riverside@inspectph.dev`      |
| Citizen           | `citizen-riverside@inspectph.dev`    |

## Suggested environment

Dashboard:

```bash
cd /home/nhad/inspect-ph/inspect-ph-dashboard
export NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
npm run dev
```

Mobile:

```bash
cd /home/nhad/inspect-ph/inspect-ph-mobile
export EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
npm start
```

If you are opening the app on a physical device and Expo shows `Could not connect to development server`, restart Metro in tunnel mode instead:

```bash
cd /home/nhad/inspect-ph/inspect-ph-mobile
export EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:4000/api/v1
npm run start:tunnel
```

API:

```bash
cd /home/nhad/inspect-ph/inspect-ph-api
npm run dev
```

Use the dashboard for office and admin roles.
Use the mobile app for inspector, business owner, and citizen flows.

Default local behavior:

- Dashboard uses `http://localhost:4000` unless `NEXT_PUBLIC_API_BASE_URL` is set.
- Mobile now uses `http://localhost:4000/api/v1` by default.
- On a physical device, point `EXPO_PUBLIC_API_URL` to your machine's LAN IP instead of `localhost`.
- If Expo cannot reach Metro on your network, use `npm run start:tunnel`.
- Only set `EXPO_PUBLIC_USE_EXPO_HOST=true` when you explicitly want Expo's network host fallback instead of local.

## Role QA matrix

Use this quick matrix before the longer checklists. Mark each row as `PASS`, `FAIL`, or `N/A` during manual QA.

| Role              | Primary surface | Must see                                                                                | Must not see                                                                    | Status |
| ----------------- | --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| Admin             | Dashboard       | Audit logs, privacy requests, users, reports, seeded scenario users                     | Mobile-first owner/citizen self-service UI as primary workflow                  | `___`  |
| LGU admin         | Dashboard       | LGU-scoped offices, users, inspections, issue reports, reports                          | Other LGUs' operational data                                                    | `___`  |
| Office supervisor | Dashboard       | Inspection queue, finding/CAP state, follow-up inspection, certificate workspace        | Platform-wide governance pages unless also admin                                | `___`  |
| Office clerk      | Dashboard       | Business intake, permit intake, payment confirmation, scenario inspection records       | Privacy requests, sessions, platform admin pages, certificate issuance controls | `___`  |
| Inspector         | Mobile          | Assigned inspections, failed finding details, attachment evidence, follow-up inspection | Dashboard-only admin and intake screens, non-assigned back-office workflows     | `___`  |
| Business owner    | Mobile          | Permit, CAP history, certificate, owner self-service timeline                           | Protected dashboard workspaces, other businesses' records, audit internals      | `___`  |
| Citizen           | Mobile          | Own issue report list and status                                                        | Protected dashboard workspaces, business-owner records, other citizens' reports | `___`  |

## Dashboard checklist

### Office clerk

Login as `clerk-riverside@inspectph.dev`.

You should be able to see:

- The Riverside Food Hub business record.
- Permit `SCN-TUG-2026-0001`.
- Paid payment reference `SCN-PAY-2026-0001`.
- The initial, follow-up, and upcoming inspection records.

You should verify:

- The permit is already in `APPROVED` status.
- The payment is in `PAID` status.
- The office context is scoped to `BPLO-RFH` / `SCN-TUG`.
- The initial inspection has a high-severity finding.

### Office supervisor

Login as `supervisor-riverside@inspectph.dev`.

You should be able to see:

- The inspection queue containing the three Riverside Food Hub inspections.
- The completed initial inspection with a blocked rear-exit finding.
- The resolved CAP tied to that finding.
- The issued certificate `FSIC-SCN-TUG-2026-0001`.

You should verify:

- The initial inspection shows one failed fire checklist result.
- The follow-up inspection shows a passing fire checklist result.
- The finding is marked resolved.
- The CAP is marked resolved.
- The certificate exists and is tied to the follow-up inspection.
- The upcoming sanitation inspection is still scheduled.

### LGU admin

Login as `lgu-admin-riverside@inspectph.dev`.

You should be able to see:

- Users, offices, modules, inspections, issue reports, and reports within `SCN-TUG` scope.
- The Riverside Food Hub issue-report traffic and inspection history.

You should verify:

- The LGU scope is limited to the scenario LGU.
- The office list includes `BPLO Riverside Scenario Office`.
- The issue report `IR-SCN-TUG-0001` is visible.
- The scenario business and permit appear in browsers and reports.

### Admin

Login as `admin-role-scenario@inspectph.dev`.

You should be able to see:

- Platform-wide operational pages.
- Audit logs for the seeded scenario.
- Privacy request `00000000-0012-4000-8a11-000000009101`.
- Sessions, users, and high-level reports.

You should verify:

- Audit logs include inspection creation, assignment, finding creation, CAP creation, reinspection request, certificate issuance, and payment status update.
- The privacy request exists for `owner-riverside@inspectph.dev` and is still pending.
- The seeded scenario users all exist with the expected roles.

## Mobile checklist

### Inspector

Login as `inspector-riverside@inspectph.dev`.

You should be able to see:

- The upcoming scheduled inspection.
- The completed follow-up inspection.
- The completed initial inspection.

You should verify:

- The inspection list contains all three Riverside Food Hub inspections.
- The initial inspection detail shows the failed fire checklist result.
- The finding title is `Rear exit blocked by LPG storage`.
- The finding has attachment evidence.
- The follow-up inspection shows a passing fire result.
- The upcoming sanitation inspection remains scheduled.

Optional action checks:

- Open the inspection detail screen and confirm checklist, finding, and attachment sections all render.
- Toggle airplane mode and confirm cached inspection detail still opens if the app already fetched it.

### Business owner

Login as `owner-riverside@inspectph.dev`.

You should be able to see:

- Permit `SCN-TUG-2026-0001`.
- The CAP history tied to the blocked rear-exit finding.
- The issued certificate `FSIC-SCN-TUG-2026-0001`.

You should verify:

- The permit is visible under owner-scoped records.
- The certificate is visible under owner-scoped certificates.
- The CAP is visible and resolved.
- The account is linked to Riverside Food Hub.

### Citizen

Login as `citizen-riverside@inspectph.dev`.

You should be able to see:

- Own issue report history.
- Report `IR-SCN-TUG-0001`.

You should verify:

- The issue report category is fire-related.
- The status is still `SUBMITTED`.
- The location description references the rear service alley beside Riverside Food Hub.

## Cross-role outcome checklist

Use this as the final acceptance pass:

- One business exists: `Riverside Food Hub`.
- One paid permit exists: `SCN-TUG-2026-0001`.
- One initial inspection exists with a failed fire checklist and a high-severity finding.
- One CAP exists and is resolved.
- One follow-up inspection exists and passes.
- One FSIC exists: `FSIC-SCN-TUG-2026-0001`.
- One future scheduled inspection exists for sanitation follow-up.
- One citizen issue report exists: `IR-SCN-TUG-0001`.
- One pending privacy request exists for the business owner.
- Audit logs and notifications exist for the major workflow transitions.

## Notes

This checklist is intentionally manual and role-oriented. It is meant to answer: can each actor sign in and immediately see the parts of the workflow they are supposed to own?

If a role cannot find its seeded records, the problem is usually one of these:

- The app is pointed at a different API base URL or database.
- The seed was run against a different database than the app is using.
- The role is correctly authenticated but the current UI does not yet expose that workflow surface.
