# Database Backup and Point-in-Time Restore Procedures

## Overview

InspectPH uses PostgreSQL as its primary persistence store. All field-captured inspections, permits, certificates, audit logs, and personal data are stored here. This document defines the backup strategy, restoration procedures, and data-retention obligations aligned with RA 10173 (Data Privacy Act of the Philippines).

---

## Backup strategy

### Automated daily snapshots

Run `pg_dump` from a cron job or CI pipeline daily:

```bash
pg_dump \
  --format=custom \
  --compress=9 \
  --no-password \
  "$DATABASE_URL" \
  > /backups/inspectph_$(date +%Y%m%d_%H%M%S).pgdump
```

`--format=custom` produces a compressed binary archive that supports selective table restore.

### Retention schedule

| Backup type         | Retention |
|---------------------|-----------|
| Daily snapshot      | 30 days   |
| Weekly snapshot     | 12 weeks  |
| Monthly snapshot    | 12 months |

Weekly and monthly snapshots can be derived by tagging cron outputs or copying the daily snapshot on the relevant day.

---

## Supabase platform backups

If InspectPH is hosted on Supabase:

1. Navigate to **Project Settings → Database → Backups**.
2. Enable **Point-in-Time Recovery (PITR)** (Pro plan and above). PITR retains WAL segments at 1-minute granularity.
3. Set the backup retention window to **30 days** minimum.
4. Download manual backups from the Supabase dashboard under **Project → Backups → Download**.

---

## Restore from `pg_dump` archive

### Full restore (fresh instance)

```bash
# 1. Create a new empty database
createdb --no-password inspectph_restore

# 2. Restore the archive
pg_restore \
  --format=custom \
  --dbname=inspectph_restore \
  --no-password \
  --verbose \
  /backups/inspectph_20260101_020000.pgdump
```

### Selective table restore

```bash
pg_restore \
  --format=custom \
  --dbname="$DATABASE_URL" \
  --table=Inspection \
  --table=AuditLog \
  --no-password \
  /backups/inspectph_20260101_020000.pgdump
```

---

## Point-in-Time Recovery (PITR) — self-hosted PostgreSQL

PITR requires WAL archiving to be configured on the primary server.

### Enable WAL archiving in `postgresql.conf`

```
wal_level = replica
archive_mode = on
archive_command = 'cp %p /wal-archive/%f'
```

### Restore to a specific point

1. Stop the PostgreSQL instance.
2. Replace the data directory with the most recent base backup.
3. Create a `recovery.conf` (PG ≤ 11) or `postgresql.conf` additions (PG ≥ 12):

```
# postgresql.conf (PG 12+)
restore_command = 'cp /wal-archive/%f %p'
recovery_target_time = '2026-01-15 14:30:00 UTC'
recovery_target_action = 'promote'
```

4. Create `recovery.signal` (empty file) in the data directory.
5. Start the instance. PostgreSQL will replay WAL until the target time and then promote.

---

## Verification

After every restore run `Prisma migrate status` to confirm schema alignment:

```bash
npx prisma migrate status
```

Run the API health check to verify the DB is reachable:

```bash
curl -s "$API_BASE_URL/api/v1/health" | jq .
# Expected: { "data": { "status": "healthy", "db": "ok" } }
```

---

## RA 10173 data privacy obligations

- Personal data in `User`, `BusinessEstablishment`, and `InspectionFinding` must not be retained beyond the statutory purpose. Run `npm run cleanup:data` weekly to purge audit logs and notifications per the configured retention thresholds (`AUDIT_LOG_RETENTION_DAYS`, `NOTIFICATION_RETENTION_DAYS`).
- Backup archives containing personal data must be stored encrypted (use `gpg --symmetric` or AWS S3 server-side encryption).
- Backup access must be restricted to authorized DBA roles only — do not store backup credentials in application `.env` files.
- Notify the NPC (National Privacy Commission) within 72 hours of any confirmed data breach affecting personal data stored in backup archives.

---

## Emergency contacts

| Role                  | Responsibility                         |
|-----------------------|----------------------------------------|
| DBA on-call           | Execute restore, verify schema         |
| Platform engineer     | Redeploy API after restore             |
| Privacy Officer       | NPC notification and user communication|
