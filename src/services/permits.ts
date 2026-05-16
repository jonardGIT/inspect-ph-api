import type { PermitRecord, Prisma } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { prisma } from "../lib/prisma.js";
import { toPublicFinding } from "./inspections.js";

export interface CreatePermitInput {
  applicationDate: string;
  businessId: string;
  createdById: string;
  expirationDate: string;
  lineOfBusiness: string;
  permitNumber: string;
}

export interface ListPermitsInput {
  businessId?: string;
  jurisdictionScope: JurisdictionScope;
  limit: number;
  page: number;
  skip: number;
  status?: PermitRecord["status"];
}

export interface PublicPermit {
  applicationDate: string;
  business: {
    businessName: string;
    id: string;
  };
  createdAt: string;
  createdById?: string;
  expirationDate: string;
  id: string;
  lineOfBusiness: string;
  permitNumber: string;
  status: Lowercase<`${PermitRecord["status"]}`>;
  updatedAt: string;
}

export interface PublicPermitLookup {
  applicationDate: string;
  business: {
    addressLine: string | null;
    businessName: string;
    city: string | null;
    contactNumber: string | null;
    id: string;
    ownerName: string | null;
  };
  createdAt: string;
  expirationDate: string;
  lineOfBusiness: string;
  permitNumber: string;
  status: Lowercase<`${PermitRecord["status"]}`>;
  updatedAt: string;
}

export interface PublicPermitFindingsLookup {
  permit: PublicPermitLookup;
  latestInspection?: {
    id: string;
    scheduledAt: string;
    completedAt?: string;
    status: "scheduled" | "in_progress" | "completed" | "cancelled";
  };
  findings: ReturnType<typeof toPublicFinding>[];
}

type PermitRecordWithBusiness = Prisma.PermitRecordGetPayload<{
  include: {
    business: {
      select: {
        businessName: true;
        id: true;
      };
    };
  };
}>;

type PermitRecordWithBusinessContact = Prisma.PermitRecordGetPayload<{
  include: {
    business: {
      select: {
        addressLine: true;
        businessName: true;
        city: true;
        contactNumber: true;
        id: true;
        ownerName: true;
      };
    };
  };
}>;

function toPublicPermit(record: PermitRecordWithBusiness): PublicPermit {
  return {
    applicationDate: record.applicationDate.toISOString(),
    business: {
      businessName: record.business.businessName,
      id: record.business.id,
    },
    createdAt: record.createdAt.toISOString(),
    createdById: record.createdById ?? undefined,
    expirationDate: record.expirationDate.toISOString(),
    id: record.id,
    lineOfBusiness: record.lineOfBusiness,
    permitNumber: record.permitNumber,
    status:
      record.status.toLowerCase() as Lowercase<`${PermitRecord["status"]}`>,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toPublicPermitLookup(
  record: PermitRecordWithBusinessContact,
): PublicPermitLookup {
  return {
    applicationDate: record.applicationDate.toISOString(),
    business: {
      addressLine: record.business.addressLine,
      businessName: record.business.businessName,
      city: record.business.city,
      contactNumber: record.business.contactNumber,
      id: record.business.id,
      ownerName: record.business.ownerName,
    },
    createdAt: record.createdAt.toISOString(),
    expirationDate: record.expirationDate.toISOString(),
    lineOfBusiness: record.lineOfBusiness,
    permitNumber: record.permitNumber,
    status:
      record.status.toLowerCase() as Lowercase<`${PermitRecord["status"]}`>,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildPermitWhere(input: ListPermitsInput) {
  const { accessScope, officeIds, lguIds } = input.jurisdictionScope;
  const scopeFilter =
    accessScope === "office" || accessScope === "assigned"
      ? {
          inspections: {
            some: {
              officeId: {
                in: officeIds,
              },
            },
          },
        }
      : accessScope === "lgu"
        ? {
            inspections: {
              some: {
                office: {
                  lguId: {
                    in: lguIds,
                  },
                },
              },
            },
          }
        : {};
  return {
    ...scopeFilter,
    ...(input.businessId ? { businessId: input.businessId } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
}

export async function listPermits(input: ListPermitsInput): Promise<{
  data: PublicPermit[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildPermitWhere(input);
  const [total, permits] = await Promise.all([
    prisma.permitRecord.count({ where }),
    prisma.permitRecord.findMany({
      include: {
        business: {
          select: {
            businessName: true,
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: permits.map(toPublicPermit),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function createPermit(
  input: CreatePermitInput,
): Promise<PublicPermit> {
  const business = await prisma.businessEstablishment.findUnique({
    where: {
      id: input.businessId,
    },
  });

  if (!business) {
    throw new AppError(
      404,
      "BUSINESS_NOT_FOUND",
      "Business establishment not found",
    );
  }

  const permit = await prisma.permitRecord.create({
    data: {
      applicationDate: new Date(input.applicationDate),
      businessId: input.businessId,
      createdById: input.createdById,
      expirationDate: new Date(input.expirationDate),
      lineOfBusiness: input.lineOfBusiness.trim(),
      permitNumber: input.permitNumber.trim(),
    },
    include: {
      business: {
        select: {
          businessName: true,
          id: true,
        },
      },
    },
  });

  return toPublicPermit(permit);
}

export async function getPublicPermitByNumber(input: {
  permitNumber: string;
}): Promise<PublicPermitLookup> {
  const permit = await prisma.permitRecord.findUnique({
    where: { permitNumber: input.permitNumber },
    include: {
      business: {
        select: {
          addressLine: true,
          businessName: true,
          city: true,
          contactNumber: true,
          id: true,
          ownerName: true,
        },
      },
    },
  });

  if (!permit) {
    throw new AppError(404, "PERMIT_NOT_FOUND", "Permit record not found");
  }

  return toPublicPermitLookup(permit);
}

export async function getPublicPermitFindingsByNumber(input: {
  permitNumber: string;
}): Promise<PublicPermitFindingsLookup> {
  const permit = await prisma.permitRecord.findUnique({
    where: { permitNumber: input.permitNumber },
    include: {
      business: {
        select: {
          addressLine: true,
          businessName: true,
          city: true,
          contactNumber: true,
          id: true,
          ownerName: true,
        },
      },
    },
  });

  if (!permit) {
    throw new AppError(404, "PERMIT_NOT_FOUND", "Permit record not found");
  }

  const latestInspection = await prisma.inspection.findFirst({
    include: {
      findings: {
        orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    where: {
      permitRecordId: permit.id,
    },
  });

  return {
    findings: latestInspection?.findings.map(toPublicFinding) ?? [],
    latestInspection: latestInspection
      ? {
          completedAt: latestInspection.completedAt?.toISOString() ?? undefined,
          id: latestInspection.id,
          scheduledAt: latestInspection.scheduledAt.toISOString(),
          status: latestInspection.status.toLowerCase() as
            | "scheduled"
            | "in_progress"
            | "completed"
            | "cancelled",
        }
      : undefined,
    permit: toPublicPermitLookup(permit),
  };
}

export interface ListOwnPermitsInput {
  userId: string;
  limit: number;
  page: number;
  skip: number;
  status?: PermitRecord["status"];
}

export async function listOwnPermits(input: ListOwnPermitsInput): Promise<{
  data: PublicPermit[];
  meta: { limit: number; page: number; total: number };
}> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return {
      data: [],
      meta: { limit: input.limit, page: input.page, total: 0 },
    };
  }

  const where: Prisma.PermitRecordWhereInput = {
    businessId: user.businessId,
    ...(input.status ? { status: input.status } : {}),
  };

  const [total, permits] = await Promise.all([
    prisma.permitRecord.count({ where }),
    prisma.permitRecord.findMany({
      include: {
        business: { select: { businessName: true, id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: permits.map(toPublicPermit),
    meta: { limit: input.limit, page: input.page, total },
  };
}

export async function archivePermit(id: string): Promise<PublicPermit> {
  const record = await prisma.permitRecord.findUnique({
    include: { business: { select: { businessName: true, id: true } } },
    where: { id },
  });

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Permit not found");
  }

  if (record.archivedAt) {
    throw new AppError(409, "CONFLICT", "Permit is already archived");
  }

  const updated = await prisma.permitRecord.update({
    data: { archivedAt: new Date() },
    include: { business: { select: { businessName: true, id: true } } },
    where: { id },
  });

  return toPublicPermit(updated);
}

export async function getPermit(id: string): Promise<PublicPermit> {
  const record = await prisma.permitRecord.findUnique({
    include: { business: { select: { businessName: true, id: true } } },
    where: { id },
  });

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Permit not found");
  }

  return toPublicPermit(record);
}

export interface UpdatePermitInput {
  applicationDate?: string;
  expirationDate?: string;
  lineOfBusiness?: string;
  permitNumber?: string;
}

export async function updatePermit(
  id: string,
  input: UpdatePermitInput,
): Promise<PublicPermit> {
  const record = await prisma.permitRecord.findUnique({
    where: { id },
  });

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Permit not found");
  }

  const updated = await prisma.permitRecord.update({
    data: {
      ...(input.applicationDate !== undefined
        ? { applicationDate: new Date(input.applicationDate) }
        : {}),
      ...(input.expirationDate !== undefined
        ? { expirationDate: new Date(input.expirationDate) }
        : {}),
      ...(input.lineOfBusiness !== undefined
        ? { lineOfBusiness: input.lineOfBusiness.trim() }
        : {}),
      ...(input.permitNumber !== undefined
        ? { permitNumber: input.permitNumber.trim() }
        : {}),
    },
    include: { business: { select: { businessName: true, id: true } } },
    where: { id },
  });

  return toPublicPermit(updated);
}

export async function requestPermitRenewal(input: {
  actorUserId: string;
  businessId: string;
}): Promise<PublicPermit> {
  const business = await prisma.businessEstablishment.findUnique({
    where: { id: input.businessId },
    include: {
      ownerUsers: { where: { id: input.actorUserId }, select: { id: true } },
      permitRecords: {
        where: { archivedAt: null },
        orderBy: { expirationDate: "desc" },
        take: 1,
        select: {
          id: true,
          lineOfBusiness: true,
          permitNumber: true,
          expirationDate: true,
          status: true,
        },
      },
    },
  });

  if (!business) {
    throw new AppError(404, "NOT_FOUND", "Business not found");
  }

  const isOwner = business.ownerUsers.length > 0;

  if (!isOwner) {
    throw new AppError(403, "FORBIDDEN", "You do not own this business");
  }

  const existing = business.permitRecords[0];
  const today = new Date();

  if (existing) {
    const daysUntilExpiry = Math.floor(
      (existing.expirationDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (existing.status === "PENDING_INSPECTION") {
      throw new AppError(
        409,
        "RENEWAL_ALREADY_PENDING",
        "A renewal application is already in progress",
      );
    }

    if (daysUntilExpiry > 90) {
      throw new AppError(
        400,
        "RENEWAL_TOO_EARLY",
        "Renewal applications can only be submitted within 90 days of permit expiration",
      );
    }
  }

  const applicationDate = today;
  const expirationDate = new Date(today);
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  // Generate a renewal permit number suffixed with -R{YYYY}
  const baseNumber =
    existing?.permitNumber ??
    `BPL-${input.businessId.slice(0, 8).toUpperCase()}`;
  const renewalPermitNumber = `${baseNumber}-R${today.getFullYear()}`;

  const permit = await prisma.permitRecord.create({
    data: {
      applicationDate,
      businessId: input.businessId,
      createdById: input.actorUserId,
      expirationDate,
      lineOfBusiness: existing?.lineOfBusiness ?? "General",
      permitNumber: renewalPermitNumber,
      status: "PENDING_INSPECTION",
    },
    include: {
      business: { select: { businessName: true, id: true } },
    },
  });

  return toPublicPermit(permit);
}
