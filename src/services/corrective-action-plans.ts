import type { CapStatus, Prisma, UserRole } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { recordAuditLog } from "./audit-logs.js";

export interface PublicCap {
  id: string;
  findingId: string;
  inspectionId: string;
  businessId: string;
  description: string;
  deadlineAt?: string;
  status: Lowercase<`${CapStatus}`>;
  responseNote?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  finding: {
    id: string;
    title: string;
    severity: string;
  };
  business: {
    id: string;
    businessName: string;
  };
  inspection: {
    id: string;
    status: string;
    scheduledAt: string;
  };
}

export interface CreateCapInput {
  actorRole: Lowercase<UserRole>;
  actorUserId: string;
  findingId: string;
  description: string;
  deadlineAt?: string;
}

export interface ListCapsInput {
  actorUserId: string;
  jurisdictionScope: JurisdictionScope;
  limit: number;
  page: number;
  skip: number;
  status?: CapStatus;
  businessId?: string;
  inspectionId?: string;
}

export interface UpdateCapStatusInput {
  actorRole: Lowercase<UserRole>;
  actorUserId: string;
  id: string;
  status: CapStatus;
  responseNote?: string;
}

type CapRow = Prisma.CorrectiveActionPlanGetPayload<{
  include: {
    finding: { select: { id: true; title: true; severity: true } };
    business: { select: { id: true; businessName: true } };
    inspection: { select: { id: true; status: true; scheduledAt: true } };
  };
}>;

function toPublicCap(row: CapRow): PublicCap {
  return {
    id: row.id,
    findingId: row.findingId,
    inspectionId: row.inspectionId,
    businessId: row.businessId,
    description: row.description,
    deadlineAt: row.deadlineAt?.toISOString(),
    status: row.status.toLowerCase() as PublicCap["status"],
    responseNote: row.responseNote ?? undefined,
    resolvedAt: row.resolvedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finding: {
      id: row.finding.id,
      title: row.finding.title,
      severity: row.finding.severity.toLowerCase(),
    },
    business: {
      id: row.business.id,
      businessName: row.business.businessName,
    },
    inspection: {
      id: row.inspection.id,
      status: row.inspection.status.toLowerCase(),
      scheduledAt: row.inspection.scheduledAt.toISOString(),
    },
  };
}

const CAP_INCLUDE = {
  finding: { select: { id: true, title: true, severity: true } },
  business: { select: { id: true, businessName: true } },
  inspection: { select: { id: true, status: true, scheduledAt: true } },
} as const;

export async function createCap(input: CreateCapInput): Promise<PublicCap> {
  const finding = await prisma.finding.findUnique({
    where: { id: input.findingId },
    include: {
      inspection: {
        include: { business: { select: { id: true } } },
      },
      cap: true,
    },
  });

  if (!finding) {
    throw new AppError(404, "NOT_FOUND", "Finding not found");
  }

  if (finding.cap) {
    throw new AppError(
      409,
      "CONFLICT",
      "A corrective action plan already exists for this finding",
    );
  }

  const cap = await prisma.correctiveActionPlan.create({
    data: {
      findingId: input.findingId,
      inspectionId: finding.inspectionId,
      businessId: finding.inspection.business.id,
      description: input.description,
      deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : undefined,
    },
    include: CAP_INCLUDE,
  });

  await recordAuditLog({
    action: "cap.created",
    actorUserId: input.actorUserId,
    entityId: cap.id,
    entityType: "cap",
    summary: `CAP created for finding "${finding.title}"`,
  });

  return toPublicCap(cap);
}

export async function listCaps(input: ListCapsInput): Promise<{
  rows: PublicCap[];
  total: number;
}> {
  const { accessScope, lguIds, officeIds } = input.jurisdictionScope;

  const scopeWhere: Prisma.CorrectiveActionPlanWhereInput =
    accessScope === "global"
      ? {}
      : accessScope === "lgu"
        ? { inspection: { office: { lguId: { in: lguIds } } } }
        : { inspection: { officeId: { in: officeIds } } };

  const where: Prisma.CorrectiveActionPlanWhereInput = {
    AND: [
      scopeWhere,
      input.status ? { status: input.status } : {},
      input.businessId ? { businessId: input.businessId } : {},
      input.inspectionId ? { inspectionId: input.inspectionId } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.correctiveActionPlan.findMany({
      where,
      include: CAP_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
    }),
    prisma.correctiveActionPlan.count({ where }),
  ]);

  return { rows: rows.map(toPublicCap), total };
}

export async function listMineCaps(input: {
  actorUserId: string;
  businessId: string;
  limit: number;
  skip: number;
  status?: CapStatus;
}): Promise<{ rows: PublicCap[]; total: number }> {
  const where: Prisma.CorrectiveActionPlanWhereInput = {
    businessId: input.businessId,
    ...(input.status ? { status: input.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.correctiveActionPlan.findMany({
      where,
      include: CAP_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
    }),
    prisma.correctiveActionPlan.count({ where }),
  ]);

  return { rows: rows.map(toPublicCap), total };
}

export async function updateCapStatus(
  input: UpdateCapStatusInput,
): Promise<PublicCap> {
  const cap = await prisma.correctiveActionPlan.findUnique({
    where: { id: input.id },
    include: CAP_INCLUDE,
  });

  if (!cap) {
    throw new AppError(404, "NOT_FOUND", "Corrective action plan not found");
  }

  const isBusinessOwner = input.actorRole === "business_owner";

  // Business owners may only acknowledge
  if (isBusinessOwner && input.status !== "ACKNOWLEDGED") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Business owners may only acknowledge a corrective action plan",
    );
  }

  const resolvedAt =
    input.status === "RESOLVED" ? new Date() : (cap.resolvedAt ?? undefined);

  const updated = await prisma.correctiveActionPlan.update({
    where: { id: input.id },
    data: {
      status: input.status,
      responseNote: input.responseNote ?? cap.responseNote,
      resolvedAt,
    },
    include: CAP_INCLUDE,
  });

  await recordAuditLog({
    action: "cap.status_updated",
    actorUserId: input.actorUserId,
    entityId: cap.id,
    entityType: "cap",
    summary: `CAP status updated to ${input.status.toLowerCase()}`,
    detail: input.responseNote,
  });

  return toPublicCap(updated);
}
