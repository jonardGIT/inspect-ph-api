import { prisma } from "../lib/prisma.js";

// ---------------------------------------------------------------------------
// Retention policy (Phase H NPC/COA compliance):
//   Inspection records     10 years
//   Attachment files        5 years  (metadata deleted; storage key flagged)
//   AuditLog entries        7 years
//   IssueReport PII         2 years  (anonymized, not deleted)
//   NotificationOutbox     30 days   (already implemented)
// ---------------------------------------------------------------------------

/** Years to add/subtract from a date. */
function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

export interface DataRetentionResult {
  attachmentMetadataDeleted: number;
  auditLogsDeleted: number;
  inspectionsDeleted: number;
  issueReportsAnonymized: number;
  notificationsDeleted: number;
}

export async function runDataRetention(input: {
  auditLogRetentionDays: number;
  notificationRetentionDays: number;
}): Promise<DataRetentionResult> {
  const now = new Date();

  const auditLogCutoff = new Date(now);
  auditLogCutoff.setDate(
    auditLogCutoff.getDate() - input.auditLogRetentionDays,
  );

  const notificationCutoff = new Date(now);
  notificationCutoff.setDate(
    notificationCutoff.getDate() - input.notificationRetentionDays,
  );

  const attachmentCutoff = yearsAgo(5);
  const inspectionCutoff = yearsAgo(10);
  const issueReportPiiCutoff = yearsAgo(2);

  const [
    auditResult,
    notificationResult,
    attachmentResult,
    inspectionResult,
    issueReportResult,
  ] = await Promise.all([
    // AuditLog: 7 years (controlled by env config, default should be 2555 days)
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditLogCutoff } },
    }),

    // NotificationOutbox: 30 days for processed/failed
    prisma.notificationOutbox.deleteMany({
      where: {
        createdAt: { lt: notificationCutoff },
        status: { in: ["PROCESSED", "FAILED"] },
      },
    }),

    // Attachment metadata: 5 years
    // Physical file deletion must be done separately via storage service
    prisma.attachment.deleteMany({
      where: { createdAt: { lt: attachmentCutoff } },
    }),

    // Inspection records: 10 years (only COMPLETED/CANCELED)
    prisma.inspection.deleteMany({
      where: {
        createdAt: { lt: inspectionCutoff },
        status: { in: ["COMPLETED", "CANCELED"] },
      },
    }),

    // IssueReport PII: anonymize after 2 years (overwrite description with
    // placeholder; email is on the related user record, not directly here)
    prisma.issueReport.updateMany({
      data: {
        description: "[anonymized]",
        locationDescription: "[anonymized]",
      },
      where: {
        createdAt: { lt: issueReportPiiCutoff },
        description: { not: "[anonymized]" },
        status: { in: ["RESOLVED", "DISMISSED"] },
      },
    }),
  ]);

  return {
    attachmentMetadataDeleted: attachmentResult.count,
    auditLogsDeleted: auditResult.count,
    inspectionsDeleted: inspectionResult.count,
    issueReportsAnonymized: issueReportResult.count,
    notificationsDeleted: notificationResult.count,
  };
}
