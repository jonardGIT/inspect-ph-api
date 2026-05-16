import type { ChecklistTemplate, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export interface PublicChecklistTemplate {
  code: string;
  createdAt: string;
  description?: string;
  id: string;
  isActive: boolean;
  module: string;
  sortOrder: number;
  title: string;
  updatedAt: string;
}

export interface ListChecklistTemplatesInput {
  isActive?: boolean;
  limit: number;
  module?: string;
  page: number;
  search?: string;
  skip: number;
}

export interface CreateChecklistTemplateInput {
  code: string;
  description?: string;
  isActive?: boolean;
  module: string;
  sortOrder?: number;
  title: string;
}

function toPublicChecklistTemplate(
  record: ChecklistTemplate,
): PublicChecklistTemplate {
  return {
    code: record.code,
    createdAt: record.createdAt.toISOString(),
    description: record.description ?? undefined,
    id: record.id,
    isActive: record.isActive,
    module: record.module,
    sortOrder: record.sortOrder,
    title: record.title,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildWhere(
  input: ListChecklistTemplatesInput,
): Prisma.ChecklistTemplateWhereInput {
  const clauses: Prisma.ChecklistTemplateWhereInput[] = [];

  if (typeof input.isActive === "boolean") {
    clauses.push({ isActive: input.isActive });
  }

  if (input.module?.trim()) {
    clauses.push({ module: { equals: input.module.trim().toUpperCase() } });
  }

  if (input.search?.trim()) {
    const value = input.search.trim();
    clauses.push({
      OR: [
        { code: { contains: value, mode: "insensitive" } },
        { title: { contains: value, mode: "insensitive" } },
        { description: { contains: value, mode: "insensitive" } },
      ],
    });
  }

  return clauses.length === 0 ? {} : { AND: clauses };
}

export async function listChecklistTemplates(
  input: ListChecklistTemplatesInput,
): Promise<{
  data: PublicChecklistTemplate[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildWhere(input);
  const [total, templates] = await Promise.all([
    prisma.checklistTemplate.count({ where }),
    prisma.checklistTemplate.findMany({
      orderBy: [{ module: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: templates.map(toPublicChecklistTemplate),
    meta: { limit: input.limit, page: input.page, total },
  };
}

export async function getChecklistTemplate(
  id: string,
): Promise<PublicChecklistTemplate> {
  const template = await prisma.checklistTemplate.findUnique({ where: { id } });

  if (!template) {
    throw new AppError(404, "NOT_FOUND", "Checklist template not found");
  }

  return toPublicChecklistTemplate(template);
}

export async function createChecklistTemplate(
  input: CreateChecklistTemplateInput,
): Promise<PublicChecklistTemplate> {
  const existing = await prisma.checklistTemplate.findUnique({
    where: { code: input.code },
  });

  if (existing) {
    throw new AppError(
      409,
      "CONFLICT",
      `A checklist template with code ${input.code} already exists`,
    );
  }

  const template = await prisma.checklistTemplate.create({
    data: {
      code: input.code.trim().toUpperCase(),
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
      module: input.module.trim().toUpperCase(),
      sortOrder: input.sortOrder ?? 0,
      title: input.title.trim(),
    },
  });

  return toPublicChecklistTemplate(template);
}

export async function updateChecklistTemplateActive(
  id: string,
  isActive: boolean,
): Promise<PublicChecklistTemplate> {
  const template = await prisma.checklistTemplate.findUnique({ where: { id } });

  if (!template) {
    throw new AppError(404, "NOT_FOUND", "Checklist template not found");
  }

  const updated = await prisma.checklistTemplate.update({
    data: { isActive },
    where: { id },
  });

  return toPublicChecklistTemplate(updated);
}

export interface UpdateChecklistTemplateInput {
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  title?: string;
}

export async function updateChecklistTemplate(
  id: string,
  input: UpdateChecklistTemplateInput,
): Promise<PublicChecklistTemplate> {
  const template = await prisma.checklistTemplate.findUnique({ where: { id } });

  if (!template) {
    throw new AppError(404, "NOT_FOUND", "Checklist template not found");
  }

  const updated = await prisma.checklistTemplate.update({
    data: {
      ...(input.description !== undefined
        ? { description: input.description?.trim() ?? null }
        : {}),
      ...(typeof input.isActive === "boolean"
        ? { isActive: input.isActive }
        : {}),
      ...(typeof input.sortOrder === "number"
        ? { sortOrder: input.sortOrder }
        : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    },
    where: { id },
  });

  return toPublicChecklistTemplate(updated);
}
