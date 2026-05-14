import type { Office, Prisma } from "@prisma/client";

import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { prisma } from "../lib/prisma.js";

export interface CreateOfficeInput {
  code: string;
  description?: string;
  lguId: string;
  name: string;
}

export interface ListOfficesInput {
  jurisdictionScope: JurisdictionScope;
  lguId?: string;
  limit: number;
  page: number;
  search?: string;
  skip: number;
}

export interface PublicOffice {
  code: string;
  createdAt: string;
  description?: string;
  id: string;
  lguId: string;
  name: string;
  updatedAt: string;
}

function toPublicOffice(record: Office): PublicOffice {
  return {
    code: record.code,
    createdAt: record.createdAt.toISOString(),
    description: record.description ?? undefined,
    id: record.id,
    lguId: record.lguId,
    name: record.name,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildOfficeWhere(input: ListOfficesInput): Prisma.OfficeWhereInput {
  const clauses: Prisma.OfficeWhereInput[] = [];

  if (input.jurisdictionScope.accessScope === "assigned") {
    clauses.push({
      id: {
        in: input.jurisdictionScope.officeIds,
      },
    });
  }

  if (input.lguId) {
    clauses.push({ lguId: input.lguId });
  }

  if (input.search?.trim()) {
    const value = input.search.trim();

    clauses.push({
      OR: [
        { id: { equals: value } },
        { code: { contains: value, mode: "insensitive" } },
        { name: { contains: value, mode: "insensitive" } },
        { description: { contains: value, mode: "insensitive" } },
      ],
    });
  }

  return clauses.length === 0 ? {} : { AND: clauses };
}

export async function listOffices(input: ListOfficesInput): Promise<{
  data: PublicOffice[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildOfficeWhere(input);
  const [total, offices] = await Promise.all([
    prisma.office.count({ where }),
    prisma.office.findMany({
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: offices.map(toPublicOffice),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function createOffice(
  input: CreateOfficeInput,
): Promise<PublicOffice> {
  const office = await prisma.office.create({
    data: {
      code: input.code.trim(),
      description: input.description?.trim() || null,
      lguId: input.lguId,
      name: input.name.trim(),
    },
  });

  return toPublicOffice(office);
}
