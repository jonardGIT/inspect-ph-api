import "../env.js";

import { prisma } from "../lib/prisma.js";

const SWEEP_BATCH_SIZE = 500;

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

export async function runStatusSweep(): Promise<void> {
  const [overdueCount, expiredPermitCount, expiredCertCount] =
    await Promise.all([
      sweepOverdueInspections(),
      sweepExpiredPermits(),
      sweepExpiredCertificates(),
    ]);

  const summary = {
    expiredCertificates: expiredCertCount,
    expiredPermits: expiredPermitCount,
    overdueInspections: overdueCount,
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
