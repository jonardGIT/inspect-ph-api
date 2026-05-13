import type { PermitRecord, Prisma } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

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

function buildPermitWhere(input: ListPermitsInput) {
  return {
    ...(input.businessId ? { businessId: input.businessId } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
}

export async function listPermits(
  input: ListPermitsInput,
): Promise<{
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
