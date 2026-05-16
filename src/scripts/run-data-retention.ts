import { prisma } from "../lib/prisma.js";

export interface DataRetentionResult {
  auditLogsDeleted: number;
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

  const [auditResult, notificationResult] = await Promise.all([
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditLogCutoff } },
    }),
    prisma.notificationOutbox.deleteMany({
      where: {
        status: { in: ["PROCESSED", "FAILED"] },
        createdAt: { lt: notificationCutoff },
      },
    }),
  ]);

  return {
    auditLogsDeleted: auditResult.count,
    notificationsDeleted: notificationResult.count,
  };
}
