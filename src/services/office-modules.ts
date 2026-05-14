import type { Prisma } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface PublicOfficeModule {
  createdAt: string;
  id: string;
  module: {
    code: string;
    id: string;
    isActive: boolean;
    name: string;
  };
  office: {
    code: string;
    id: string;
    lguId: string;
    name: string;
  };
}

export interface ListOfficeModulesInput {
  limit: number;
  moduleId?: string;
  officeId?: string;
  page: number;
  skip: number;
}

function toPublicOfficeModule(
  record: Prisma.OfficeModuleGetPayload<{
    include: {
      module: true;
      office: true;
    };
  }>,
): PublicOfficeModule {
  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    module: {
      code: record.module.code,
      id: record.module.id,
      isActive: record.module.isActive,
      name: record.module.name,
    },
    office: {
      code: record.office.code,
      id: record.office.id,
      lguId: record.office.lguId,
      name: record.office.name,
    },
  };
}

function buildOfficeModuleWhere(
  input: ListOfficeModulesInput,
): Prisma.OfficeModuleWhereInput {
  const clauses: Prisma.OfficeModuleWhereInput[] = [];

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  }

  if (input.moduleId) {
    clauses.push({ moduleId: input.moduleId });
  }

  return clauses.length === 0 ? {} : { AND: clauses };
}

export async function listOfficeModules(
  input: ListOfficeModulesInput,
): Promise<{
  data: PublicOfficeModule[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildOfficeModuleWhere(input);
  const [total, assignments] = await Promise.all([
    prisma.officeModule.count({ where }),
    prisma.officeModule.findMany({
      include: {
        module: true,
        office: true,
      },
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: assignments.map(toPublicOfficeModule),
    meta: { limit: input.limit, page: input.page, total },
  };
}

export async function createOfficeModule(input: {
  moduleId: string;
  officeId: string;
}): Promise<PublicOfficeModule> {
  const [module, office] = await Promise.all([
    prisma.module.findUnique({ where: { id: input.moduleId } }),
    prisma.office.findUnique({ where: { id: input.officeId } }),
  ]);

  if (!module) {
    throw new AppError(404, "MODULE_NOT_FOUND", "Module not found");
  }

  if (!office) {
    throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found");
  }

  const assignment = await prisma.officeModule.upsert({
    where: {
      officeId_moduleId: {
        moduleId: input.moduleId,
        officeId: input.officeId,
      },
    },
    create: {
      moduleId: input.moduleId,
      officeId: input.officeId,
    },
    update: {},
    include: {
      module: true,
      office: true,
    },
  });

  return toPublicOfficeModule(assignment);
}

export async function deleteOfficeModule(input: { assignmentId: string }) {
  const assignment = await prisma.officeModule.findUnique({
    where: { id: input.assignmentId },
  });

  if (!assignment) {
    throw new AppError(
      404,
      "OFFICE_MODULE_NOT_FOUND",
      "Office module assignment not found",
    );
  }

  await prisma.officeModule.delete({ where: { id: input.assignmentId } });
}
