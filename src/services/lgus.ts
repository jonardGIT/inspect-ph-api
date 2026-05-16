import type { Lgu, Prisma } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { prisma } from "../lib/prisma.js";

export interface CreateLguInput {
  city?: string;
  code: string;
  name: string;
  province?: string;
  region?: string;
}

export interface ListLgusInput {
  jurisdictionScope: JurisdictionScope;
  limit: number;
  page: number;
  search?: string;
  skip: number;
}

export interface PublicLgu {
  city?: string;
  code: string;
  createdAt: string;
  id: string;
  name: string;
  province?: string;
  region?: string;
  updatedAt: string;
}

function toPublicLgu(record: Lgu): PublicLgu {
  return {
    city: record.city ?? undefined,
    code: record.code,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    province: record.province ?? undefined,
    region: record.region ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildLguWhere(input: ListLgusInput): Prisma.LguWhereInput {
  const clauses: Prisma.LguWhereInput[] = [{ archivedAt: null }];

  if (input.jurisdictionScope.accessScope !== "global") {
    clauses.push({
      id: {
        in: input.jurisdictionScope.lguIds,
      },
    });
  }

  if (input.search?.trim()) {
    const value = input.search.trim();

    clauses.push({
      OR: [
        { id: { equals: value } },
        { code: { contains: value, mode: "insensitive" } },
        { name: { contains: value, mode: "insensitive" } },
        { region: { contains: value, mode: "insensitive" } },
        { province: { contains: value, mode: "insensitive" } },
        { city: { contains: value, mode: "insensitive" } },
      ],
    });
  }

  return clauses.length === 0 ? {} : { AND: clauses };
}

export async function listLgus(input: ListLgusInput): Promise<{
  data: PublicLgu[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildLguWhere(input);
  const [total, lgus] = await Promise.all([
    prisma.lgu.count({ where }),
    prisma.lgu.findMany({
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: lgus.map(toPublicLgu),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function createLgu(input: CreateLguInput): Promise<PublicLgu> {
  const lgu = await prisma.lgu.create({
    data: {
      city: input.city?.trim() || null,
      code: input.code.trim(),
      name: input.name.trim(),
      province: input.province?.trim() || null,
      region: input.region?.trim() || null,
    },
  });

  return toPublicLgu(lgu);
}

export async function archiveLgu(id: string): Promise<void> {
  const lgu = await prisma.lgu.findUnique({
    where: { id },
    select: { id: true, archivedAt: true },
  });

  if (!lgu) {
    throw new AppError(404, "LGU_NOT_FOUND", "LGU not found");
  }

  if (lgu.archivedAt) {
    throw new AppError(409, "LGU_ALREADY_ARCHIVED", "LGU is already archived");
  }

  await prisma.lgu.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}
