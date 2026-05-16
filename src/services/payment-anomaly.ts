import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";

export type AnomalyReason =
  | "DUPLICATE"
  | "AMOUNT_MISMATCH"
  | "LOW_AMOUNT"
  | "HIGH_VELOCITY";

interface AnomalyCheck {
  reason: AnomalyReason;
  detail: string;
}

// Minimum plausible payment amount: 10 PHP (1000 minor units)
const MIN_PLAUSIBLE_AMOUNT = 1000;

// High-velocity window: 3 payments within 5 minutes for the same permit
const VELOCITY_WINDOW_MS = 5 * 60 * 1000;
const VELOCITY_MAX = 3;

async function detectAnomalies(paymentId: string): Promise<AnomalyCheck[]> {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: { permitRecord: true },
  });

  if (!payment) return [];

  const detected: AnomalyCheck[] = [];

  // ── LOW_AMOUNT ────────────────────────────────────────────────────────────
  if (payment.amountInMinor < MIN_PLAUSIBLE_AMOUNT) {
    detected.push({
      reason: "LOW_AMOUNT",
      detail: `Payment amount ${payment.amountInMinor} minor units is below minimum threshold (${MIN_PLAUSIBLE_AMOUNT}).`,
    });
  }

  // ── DUPLICATE ─────────────────────────────────────────────────────────────
  // Same permit already has a PAID payment
  const duplicatePaid = await prisma.paymentRecord.findFirst({
    where: {
      id: { not: paymentId },
      permitRecordId: payment.permitRecordId,
      status: "PAID",
    },
  });
  if (duplicatePaid) {
    detected.push({
      reason: "DUPLICATE",
      detail: `Permit ${payment.permitRecordId} already has a paid payment (${duplicatePaid.referenceNumber}).`,
    });
  }

  // ── AMOUNT_MISMATCH ───────────────────────────────────────────────────────
  // Significant difference (>20%) vs. other payments for the same permit
  const sibling = await prisma.paymentRecord.findFirst({
    where: {
      id: { not: paymentId },
      permitRecordId: payment.permitRecordId,
      status: { in: ["PAID", "PENDING", "PROCESSING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (sibling && sibling.amountInMinor > 0) {
    const diff =
      Math.abs(payment.amountInMinor - sibling.amountInMinor) /
      sibling.amountInMinor;
    if (diff > 0.2) {
      detected.push({
        reason: "AMOUNT_MISMATCH",
        detail: `Amount ${payment.amountInMinor} differs by ${Math.round(diff * 100)}% from reference payment ${sibling.referenceNumber} (${sibling.amountInMinor}).`,
      });
    }
  }

  // ── HIGH_VELOCITY ─────────────────────────────────────────────────────────
  // More than VELOCITY_MAX payments for same permit within VELOCITY_WINDOW_MS
  const windowStart = new Date(
    payment.createdAt.getTime() - VELOCITY_WINDOW_MS,
  );
  const recentCount = await prisma.paymentRecord.count({
    where: {
      id: { not: paymentId },
      permitRecordId: payment.permitRecordId,
      createdAt: { gte: windowStart },
    },
  });
  if (recentCount >= VELOCITY_MAX) {
    detected.push({
      reason: "HIGH_VELOCITY",
      detail: `${recentCount} additional payments for permit ${payment.permitRecordId} within the past 5 minutes.`,
    });
  }

  return detected;
}

/**
 * Run anomaly detection on a payment. If anomalies are found, quarantine the
 * payment (set to FAILED with reason) and create PaymentAnomalyFlag records.
 * Returns true if the payment was quarantined.
 */
export async function detectAndFlagAnomalies(
  paymentId: string,
): Promise<boolean> {
  const anomalies = await detectAnomalies(paymentId);
  if (anomalies.length === 0) return false;

  const quarantineReason = anomalies.map((a) => a.reason).join(", ");
  const quarantineDetail = anomalies.map((a) => a.detail).join(" | ");

  await prisma.$transaction([
    prisma.paymentRecord.update({
      where: { id: paymentId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: `QUARANTINED: ${quarantineReason}. ${quarantineDetail}`,
      },
    }),
    ...anomalies.map((a) =>
      prisma.paymentAnomalyFlag.create({
        data: {
          paymentId,
          reason: a.reason,
          detail: a.detail,
        },
      }),
    ),
  ]);

  await recordAuditLog({
    action: "payment.anomaly_detected",
    entityId: paymentId,
    entityType: "payment",
    summary: `Payment ${paymentId} quarantined: ${quarantineReason}`,
    detail: quarantineDetail,
  });

  return true;
}

export interface PaymentAnomalyFlagPublic {
  id: string;
  paymentId: string;
  reason: string;
  detail: string | null;
  quarantinedAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  payment: {
    referenceNumber: string;
    amountInMinor: number;
    permitRecordId: string;
  };
}

function toPublicFlag(flag: {
  id: string;
  paymentId: string;
  reason: string;
  detail: string | null;
  quarantinedAt: Date;
  resolvedAt: Date | null;
  resolvedById: string | null;
  payment: {
    referenceNumber: string;
    amountInMinor: number;
    permitRecordId: string;
  };
}): PaymentAnomalyFlagPublic {
  return {
    ...flag,
    quarantinedAt: flag.quarantinedAt.toISOString(),
    resolvedAt: flag.resolvedAt?.toISOString() ?? null,
  };
}

export async function listAnomalyFlags(input: {
  includeResolved?: boolean;
  lguId?: string;
  page: number;
  limit: number;
}): Promise<{ items: PaymentAnomalyFlagPublic[]; total: number }> {
  const skip = (input.page - 1) * input.limit;

  const where = {
    ...(input.includeResolved ? {} : { resolvedAt: null }),
    ...(input.lguId
      ? {
          payment: {
            permitRecord: {
              inspections: { some: { office: { lguId: input.lguId } } },
            },
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.paymentAnomalyFlag.findMany({
      include: {
        payment: {
          select: {
            referenceNumber: true,
            amountInMinor: true,
            permitRecordId: true,
          },
        },
      },
      orderBy: { quarantinedAt: "desc" },
      skip,
      take: input.limit,
      where,
    }),
    prisma.paymentAnomalyFlag.count({ where }),
  ]);

  return { items: items.map(toPublicFlag), total };
}

export async function resolveAnomalyFlag(
  flagId: string,
  resolvedById: string,
): Promise<PaymentAnomalyFlagPublic> {
  const flag = await prisma.paymentAnomalyFlag.findUnique({
    where: { id: flagId },
  });
  if (!flag) {
    const { AppError } = await import("../lib/errors.js");
    throw new AppError(404, "FLAG_NOT_FOUND", "Anomaly flag not found");
  }

  const updated = await prisma.paymentAnomalyFlag.update({
    where: { id: flagId },
    data: { resolvedAt: new Date(), resolvedById },
    include: {
      payment: {
        select: {
          referenceNumber: true,
          amountInMinor: true,
          permitRecordId: true,
        },
      },
    },
  });

  await recordAuditLog({
    action: "payment.anomaly_resolved",
    actorUserId: resolvedById,
    entityId: flagId,
    entityType: "payment_anomaly_flag",
    summary: `Anomaly flag ${flagId} resolved by ${resolvedById}`,
  });

  return toPublicFlag(updated);
}
