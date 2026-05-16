import type { Module, Prisma } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface CreateModuleInput {
  code: string;
  description?: string;
  isActive?: boolean;
  name: string;
}

export interface ListModulesInput {
  isActive?: boolean;
  limit: number;
  page: number;
  search?: string;
  skip: number;
}

export interface PublicModule {
  archivedAt?: string;
  code: string;
  createdAt: string;
  description?: string;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: string;
}

function toPublicModule(record: Module): PublicModule {
  return {
    archivedAt: record.archivedAt?.toISOString(),
    code: record.code,
    createdAt: record.createdAt.toISOString(),
    description: record.description ?? undefined,
    id: record.id,
    isActive: record.isActive,
    name: record.name,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildModuleWhere(input: ListModulesInput): Prisma.ModuleWhereInput {
  const clauses: Prisma.ModuleWhereInput[] = [];

  if (typeof input.isActive === "boolean") {
    clauses.push({ isActive: input.isActive });
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

export async function listModules(input: ListModulesInput): Promise<{
  data: PublicModule[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildModuleWhere(input);
  const [total, modules] = await Promise.all([
    prisma.module.count({ where }),
    prisma.module.findMany({
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: modules.map(toPublicModule),
    meta: { limit: input.limit, page: input.page, total },
  };
}

export async function getModule(id: string): Promise<PublicModule> {
  const record = await prisma.module.findUnique({ where: { id } });

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Module not found");
  }

  return toPublicModule(record);
}

export async function archiveModule(id: string): Promise<PublicModule> {
  const record = await prisma.module.findUnique({ where: { id } });

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Module not found");
  }

  if (record.archivedAt) {
    throw new AppError(409, "CONFLICT", "Module is already archived");
  }

  const updated = await prisma.module.update({
    data: { archivedAt: new Date(), isActive: false },
    where: { id },
  });

  return toPublicModule(updated);
}

export async function createModule(
  input: CreateModuleInput,
): Promise<PublicModule> {
  const module = await prisma.module.create({
    data: {
      code: input.code.trim(),
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
      name: input.name.trim(),
    },
  });

  return toPublicModule(module);
}
