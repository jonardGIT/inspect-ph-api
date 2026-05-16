import type { FindingDisputeStatus } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";

export interface FindingDisputeRecord {
  id: string;
  findingId: string;
  reason: string;
  status: Lowercase<`${FindingDisputeStatus}`>;
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  finding: {
    id: string;
    title: string;
    severity: string;
    inspectionId: string;
  };
  disputedBy: {
    id: string;
    name: string;
    email: string;
  };
  resolvedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

function toRecord(
  d: Awaited<ReturnType<typeof fetchDispute>>,
): FindingDisputeRecord {
  return {
    createdAt: d.createdAt.toISOString(),
    disputedBy: {
      email: d.disputedBy.email,
      id: d.disputedBy.id,
      name: d.disputedBy.name,
    },
    finding: {
      id: d.finding.id,
      inspectionId: d.finding.inspectionId,
      severity: d.finding.severity.toLowerCase(),
      title: d.finding.title,
    },
    id: d.id,
    findingId: d.findingId,
    reason: d.reason,
    resolution: d.resolution ?? undefined,
    resolvedAt: d.resolvedAt?.toISOString(),
    resolvedBy: d.resolvedBy
      ? {
          email: d.resolvedBy.email,
          id: d.resolvedBy.id,
          name: d.resolvedBy.name,
        }
      : undefined,
    status: d.status.toLowerCase() as Lowercase<`${FindingDisputeStatus}`>,
    updatedAt: d.updatedAt.toISOString(),
  };
}

const DISPUTE_INCLUDE = {
  disputedBy: { select: { email: true, id: true, name: true } },
  finding: {
    select: { id: true, inspectionId: true, severity: true, title: true },
  },
  resolvedBy: { select: { email: true, id: true, name: true } },
} as const;

async function fetchDispute(findingId: string) {
  const record = await prisma.findingDispute.findUnique({
    where: { findingId },
    include: DISPUTE_INCLUDE,
  });

  if (!record) {
    throw new AppError(
      404,
      "FINDING_DISPUTE_NOT_FOUND",
      "No dispute found for this finding",
    );
  }

  return record;
}

export async function createFindingDispute(input: {
  actorUserId: string;
  findingId: string;
  reason: string;
}): Promise<FindingDisputeRecord> {
  // Verify the finding exists and belongs to a business owned by the actor
  const finding = await prisma.finding.findUnique({
    where: { id: input.findingId },
    select: {
      id: true,
      title: true,
      severity: true,
      inspectionId: true,
      inspection: {
        select: {
          business: {
            select: {
              id: true,
              ownerUsers: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!finding) {
    throw new AppError(404, "FINDING_NOT_FOUND", "Finding not found");
  }

  const ownsBusinesss = finding.inspection.business.ownerUsers.some(
    (u) => u.id === input.actorUserId,
  );

  if (!ownsBusinesss) {
    throw new AppError(
      403,
      "DISPUTE_FORBIDDEN",
      "You can only dispute findings for your own business",
    );
  }

  const existing = await prisma.findingDispute.findUnique({
    where: { findingId: input.findingId },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      409,
      "DISPUTE_ALREADY_EXISTS",
      "A dispute already exists for this finding",
    );
  }

  const record = await prisma.findingDispute.create({
    data: {
      disputedByUserId: input.actorUserId,
      findingId: input.findingId,
      reason: input.reason.trim(),
      status: "PENDING",
    },
    include: DISPUTE_INCLUDE,
  });

  await recordAuditLog({
    action: "finding.dispute_submitted",
    actorRole: "business_owner",
    actorUserId: input.actorUserId,
    entityId: input.findingId,
    entityType: "finding",
    summary: `Dispute submitted for finding "${finding.title}"`,
  });

  return toRecord(record);
}

export async function getDisputeByFinding(
  findingId: string,
): Promise<FindingDisputeRecord> {
  return toRecord(await fetchDispute(findingId));
}

export async function resolveDispute(input: {
  actorUserId: string;
  actorRole: string;
  findingId: string;
  status: "REVIEWING" | "UPHELD" | "OVERTURNED";
  resolution?: string;
}): Promise<FindingDisputeRecord> {
  const existing = await prisma.findingDispute.findUnique({
    where: { findingId: input.findingId },
    select: { id: true, status: true, finding: { select: { title: true } } },
  });

  if (!existing) {
    throw new AppError(
      404,
      "FINDING_DISPUTE_NOT_FOUND",
      "No dispute found for this finding",
    );
  }

  if (existing.status === "UPHELD" || existing.status === "OVERTURNED") {
    throw new AppError(
      409,
      "DISPUTE_ALREADY_RESOLVED",
      "This dispute has already been resolved",
    );
  }

  const isTerminal = input.status === "UPHELD" || input.status === "OVERTURNED";

  const record = await prisma.findingDispute.update({
    where: { findingId: input.findingId },
    data: {
      resolution: input.resolution?.trim() ?? null,
      resolvedAt: isTerminal ? new Date() : null,
      resolvedByUserId: isTerminal ? input.actorUserId : null,
      status: input.status,
    },
    include: DISPUTE_INCLUDE,
  });

  await recordAuditLog({
    action: "finding.dispute_resolved",
    actorRole: input.actorRole as never,
    actorUserId: input.actorUserId,
    entityId: input.findingId,
    entityType: "finding",
    summary: `Dispute for finding "${existing.finding.title}" marked ${input.status.toLowerCase()}`,
  });

  return toRecord(record);
}
