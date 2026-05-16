import "../env.js";

import { prisma } from "../lib/prisma.js";

const SWEEP_BATCH_SIZE = 500;
const REMINDER_HORIZONS_DAYS = [30, 14, 7];

async function sweepOverdueInspections() {
  const now = new Date();

  const rows = await prisma.inspection.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lt: now },
    },
    select: { id: true },
    take: SWEEP_BATCH_SIZE,
  });

  if (rows.length === 0) {
    return 0;
  }

  const ids = rows.map((r) => r.id);

  await prisma.$transaction([
    prisma.inspection.updateMany({
      where: { id: { in: ids } },
      data: { status: "OVERDUE" },
    }),
    prisma.auditLog.createMany({
      data: ids.map((id) => ({
        action: "inspection.status_updated",
        detail: "Automated sweep: status transitioned to OVERDUE",
        entityId: id,
        entityType: "inspection",
        summary: "Inspection marked overdue by scheduled sweep",
      })),
    }),
  ]);

  return ids.length;
}

async function sweepExpiredPermits() {
  const now = new Date();

  const rows = await prisma.permitRecord.findMany({
    where: {
      status: { notIn: ["REJECTED", "EXPIRED"] },
      expirationDate: { lt: now },
    },
    select: { id: true },
    take: SWEEP_BATCH_SIZE,
  });

  if (rows.length === 0) {
    return 0;
  }

  const ids = rows.map((r) => r.id);

  await prisma.$transaction([
    prisma.permitRecord.updateMany({
      where: { id: { in: ids } },
      data: { status: "EXPIRED" },
    }),
    prisma.auditLog.createMany({
      data: ids.map((id) => ({
        action: "inspection.status_updated",
        detail: "Automated sweep: permit status transitioned to EXPIRED",
        entityId: id,
        entityType: "inspection",
        summary: "Permit marked expired by scheduled sweep",
      })),
    }),
  ]);

  return ids.length;
}

async function sweepExpiredCertificates() {
  const now = new Date();

  const rows = await prisma.fireSafetyCertificate.findMany({
    where: {
      status: "ISSUED",
      expiresAt: { lt: now },
    },
    select: { id: true },
    take: SWEEP_BATCH_SIZE,
  });

  if (rows.length === 0) {
    return 0;
  }

  const ids = rows.map((r) => r.id);

  await prisma.fireSafetyCertificate.updateMany({
    where: { id: { in: ids } },
    data: { status: "EXPIRED" },
  });

  return ids.length;
}

async function sweepPermitExpiryReminders(): Promise<number> {
  const now = new Date();
  let total = 0;

  for (const days of REMINDER_HORIZONS_DAYS) {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + days - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + days);

    const permits = await prisma.permitRecord.findMany({
      where: {
        status: { notIn: ["REJECTED", "EXPIRED"] },
        archivedAt: null,
        expirationDate: { gte: windowStart, lt: windowEnd },
        business: {
          ownerUsers: {
            some: { role: "BUSINESS_OWNER" },
          },
        },
      },
      select: {
        id: true,
        permitNumber: true,
        expirationDate: true,
        business: {
          select: {
            businessName: true,
            ownerUsers: {
              where: { role: "BUSINESS_OWNER" },
              select: { id: true },
            },
          },
        },
      },
      take: SWEEP_BATCH_SIZE,
    });

    if (permits.length === 0) continue;

    const notifications: {
      recipientUserId: string;
      eventType: string;
      title: string;
      body: string;
      entityType: string;
      entityId: string;
    }[] = [];

    for (const permit of permits) {
      for (const owner of permit.business.ownerUsers) {
        // Check if we already queued a reminder for this permit + horizon today
        const alreadySent = await prisma.notificationOutbox.findFirst({
          where: {
            recipientUserId: owner.id,
            entityId: permit.id,
            eventType: "permit.expiry_reminder",
            createdAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            },
          },
          select: { id: true },
        });

        if (alreadySent) continue;

        notifications.push({
          recipientUserId: owner.id,
          eventType: "permit.expiry_reminder",
          title: `Permit expiring in ${days} days`,
          body: `Your permit ${permit.permitNumber} for ${permit.business.businessName} expires on ${permit.expirationDate.toLocaleDateString("en-PH")}.`,
          entityType: "permit",
          entityId: permit.id,
        });
      }
    }

    if (notifications.length > 0) {
      await prisma.notificationOutbox.createMany({ data: notifications });
      total += notifications.length;
    }
  }

  return total;
}

export async function runStatusSweep(): Promise<void> {
  const [overdueCount, expiredPermitCount, expiredCertCount, reminderCount] =
    await Promise.all([
      sweepOverdueInspections(),
      sweepExpiredPermits(),
      sweepExpiredCertificates(),
      sweepPermitExpiryReminders(),
    ]);

  const summary = {
    expiredCertificates: expiredCertCount,
    expiredPermits: expiredPermitCount,
    overdueInspections: overdueCount,
    permitExpiryReminders: reminderCount,
    sweepAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  await runStatusSweep();
}

main()
  .catch((error) => {
    console.error("Status sweep failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
