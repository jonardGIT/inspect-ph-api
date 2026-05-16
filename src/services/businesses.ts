import type { BusinessEstablishment, Prisma } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { prisma } from "../lib/prisma.js";

export interface CreateBusinessInput {
  addressLine: string;
  barangay: string;
  businessName: string;
  city: string;
  contactNumber?: string;
  ownerName: string;
  province: string;
  taxIdentificationNumber?: string;
  tradeName?: string;
}

export interface ListBusinessesInput {
  barangay?: string;
  city?: string;
  jurisdictionScope: JurisdictionScope;
  limit: number;
  page: number;
  search?: string;
  skip: number;
}

export interface PublicBusiness {
  addressLine: string;
  barangay: string;
  businessName: string;
  city: string;
  contactNumber?: string;
  createdAt: string;
  id: string;
  ownerName: string;
  province: string;
  taxIdentificationNumber?: string;
  tradeName?: string;
  updatedAt: string;
}

function toPublicBusiness(record: BusinessEstablishment): PublicBusiness {
  return {
    addressLine: record.addressLine,
    barangay: record.barangay,
    businessName: record.businessName,
    city: record.city,
    contactNumber: record.contactNumber ?? undefined,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    ownerName: record.ownerName,
    province: record.province,
    taxIdentificationNumber: record.taxIdentificationNumber ?? undefined,
    tradeName: record.tradeName ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildBusinessWhere(input: ListBusinessesInput) {
  const clauses: Prisma.BusinessEstablishmentWhereInput[] = [];

  const { accessScope, officeIds, lguIds } = input.jurisdictionScope;
  if (accessScope === "office" || accessScope === "assigned") {
    clauses.push({
      inspections: {
        some: {
          officeId: {
            in: officeIds,
          },
        },
      },
    });
  } else if (accessScope === "lgu") {
    clauses.push({
      inspections: {
        some: {
          office: {
            lguId: {
              in: lguIds,
            },
          },
        },
      },
    });
  }

  if (input.city) {
    clauses.push({ city: { equals: input.city.trim(), mode: "insensitive" } });
  }

  if (input.barangay) {
    clauses.push({
      barangay: { equals: input.barangay.trim(), mode: "insensitive" },
    });
  }

  if (input.search) {
    const value = input.search.trim();

    clauses.push({
      OR: [
        { id: { equals: value } },
        {
          businessName: { contains: value, mode: "insensitive" },
        },
        { ownerName: { contains: value, mode: "insensitive" } },
        { tradeName: { contains: value, mode: "insensitive" } },
      ],
    });
  }

  if (clauses.length === 0) {
    return {};
  }

  return { AND: clauses };
}

export async function listBusinesses(input: ListBusinessesInput): Promise<{
  data: PublicBusiness[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildBusinessWhere(input);
  const [total, businesses] = await Promise.all([
    prisma.businessEstablishment.count({ where }),
    prisma.businessEstablishment.findMany({
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: businesses.map(toPublicBusiness),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function createBusiness(
  input: CreateBusinessInput,
): Promise<PublicBusiness> {
  const business = await prisma.businessEstablishment.create({
    data: {
      addressLine: input.addressLine.trim(),
      barangay: input.barangay.trim(),
      businessName: input.businessName.trim(),
      city: input.city.trim(),
      contactNumber: input.contactNumber?.trim() || null,
      ownerName: input.ownerName.trim(),
      province: input.province.trim(),
      taxIdentificationNumber: input.taxIdentificationNumber?.trim() || null,
      tradeName: input.tradeName?.trim() || null,
    },
  });

  return toPublicBusiness(business);
}

export async function archiveBusiness(id: string): Promise<PublicBusiness> {
  const record = await prisma.businessEstablishment.findUnique({
    where: { id },
  });

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Business not found");
  }

  if (record.archivedAt) {
    throw new AppError(409, "CONFLICT", "Business is already archived");
  }

  const updated = await prisma.businessEstablishment.update({
    data: { archivedAt: new Date() },
    where: { id },
  });

  return toPublicBusiness(updated);
}
