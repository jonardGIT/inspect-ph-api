import type { ChecklistTemplate } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { recordAuditLog } from "./audit-logs.js";
import { createListMeta } from "../lib/request.js";

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface MarketplaceTemplate {
  id: string;
  code: string;
  module: string;
  title: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  version: number;
  lguId: string | null;
  forkedFromId: string | null;
  isMarketplace: boolean;
  publishedAt: string | null;
  avgRating: number | null;
  ratingCount: number;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateRating {
  id: string;
  templateId: string;
  lguId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withCounts(
  template: ChecklistTemplate,
): Promise<MarketplaceTemplate> {
  const [ratingAgg, forkCount] = await Promise.all([
    prisma.checklistTemplateRating.aggregate({
      _avg: { rating: true },
      _count: { id: true },
      where: { templateId: template.id },
    }),
    prisma.checklistTemplate.count({ where: { forkedFromId: template.id } }),
  ]);

  return {
    avgRating: ratingAgg._avg.rating ?? null,
    code: template.code,
    createdAt: template.createdAt.toISOString(),
    description: template.description ?? undefined,
    forkCount,
    forkedFromId: template.forkedFromId,
    id: template.id,
    isActive: template.isActive,
    isMarketplace: template.isMarketplace,
    lguId: template.lguId,
    module: template.module,
    publishedAt: template.publishedAt?.toISOString() ?? null,
    ratingCount: ratingAgg._count.id,
    sortOrder: template.sortOrder,
    title: template.title,
    updatedAt: template.updatedAt.toISOString(),
    version: template.version,
  };
}

// ---------------------------------------------------------------------------
// List marketplace templates
// ---------------------------------------------------------------------------

export interface ListMarketplaceInput {
  limit: number;
  module?: string;
  page: number;
  search?: string;
  skip: number;
}

export async function listMarketplaceTemplates(
  input: ListMarketplaceInput,
): Promise<{
  data: MarketplaceTemplate[];
  meta: { limit: number; page: number; total: number };
}> {
  const clauses = [{ isMarketplace: true }] as object[];

  if (input.module?.trim()) {
    clauses.push({ module: { equals: input.module.trim().toUpperCase() } });
  }

  if (input.search?.trim()) {
    const v = input.search.trim();
    clauses.push({
      OR: [
        { code: { contains: v, mode: "insensitive" } },
        { title: { contains: v, mode: "insensitive" } },
        { description: { contains: v, mode: "insensitive" } },
      ],
    });
  }

  const where = { AND: clauses };

  const [total, templates] = await Promise.all([
    prisma.checklistTemplate.count({ where }),
    prisma.checklistTemplate.findMany({
      orderBy: [{ module: "asc" }, { sortOrder: "asc" }],
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  const data = await Promise.all(templates.map(withCounts));

  return { data, meta: createListMeta(total, input.page, input.limit) };
}

// ---------------------------------------------------------------------------
// Fork a template into an LGU namespace
// ---------------------------------------------------------------------------

export async function forkChecklistTemplate(
  templateId: string,
  lguId: string,
  actorUserId: string,
): Promise<MarketplaceTemplate> {
  const source = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
  });

  if (!source) {
    throw new AppError(404, "NOT_FOUND", "Checklist template not found");
  }

  const lgu = await prisma.lgu.findUnique({ where: { id: lguId } });

  if (!lgu) {
    throw new AppError(404, "NOT_FOUND", "LGU not found");
  }

  // Build a unique code for the fork
  const suffix = `_FORK_${lguId.slice(0, 8).toUpperCase()}`;
  const baseCode = source.code.slice(0, 60); // keep within a safe length
  let forkCode = `${baseCode}${suffix}`;

  // Ensure uniqueness (rare collision guard)
  const conflict = await prisma.checklistTemplate.findUnique({
    where: { code: forkCode },
  });

  if (conflict) {
    forkCode = `${baseCode}${suffix}_${Date.now()}`;
  }

  const forked = await prisma.checklistTemplate.create({
    data: {
      code: forkCode,
      description: source.description,
      forkedFromId: source.id,
      isActive: true,
      isMarketplace: false,
      lguId,
      module: source.module,
      sortOrder: source.sortOrder,
      title: source.title,
      version: source.version,
    },
  });

  await recordAuditLog({
    action: "checklist_template.forked",
    actorUserId,
    detail: `forkedFromId=${source.id} newTemplateId=${forked.id}`,
    entityId: forked.id,
    entityType: "checklist_template",
    summary: `Template ${source.code} forked into LGU ${lguId}`,
  });

  return withCounts(forked);
}

// ---------------------------------------------------------------------------
// Publish template to marketplace
// ---------------------------------------------------------------------------

export async function publishChecklistTemplate(
  templateId: string,
  actorUserId: string,
): Promise<MarketplaceTemplate> {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new AppError(404, "NOT_FOUND", "Checklist template not found");
  }

  if (template.isMarketplace) {
    throw new AppError(
      409,
      "ALREADY_PUBLISHED",
      "Template is already in the marketplace",
    );
  }

  const updated = await prisma.checklistTemplate.update({
    data: { isMarketplace: true, publishedAt: new Date() },
    where: { id: templateId },
  });

  await recordAuditLog({
    action: "checklist_template.published",
    actorUserId,
    entityId: templateId,
    entityType: "checklist_template",
    summary: `Checklist template ${template.code} published to marketplace`,
  });

  return withCounts(updated);
}

// ---------------------------------------------------------------------------
// Promote template to platform-default (admin only — clears lguId)
// ---------------------------------------------------------------------------

export async function promoteToDefault(
  templateId: string,
  actorUserId: string,
): Promise<MarketplaceTemplate> {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new AppError(404, "NOT_FOUND", "Checklist template not found");
  }

  if (template.lguId === null) {
    throw new AppError(
      409,
      "ALREADY_PLATFORM_DEFAULT",
      "Template is already a platform-default",
    );
  }

  const updated = await prisma.checklistTemplate.update({
    data: { lguId: null },
    where: { id: templateId },
  });

  await recordAuditLog({
    action: "checklist_template.promoted",
    actorUserId,
    entityId: templateId,
    entityType: "checklist_template",
    summary: `Checklist template ${template.code} promoted to platform-default`,
  });

  return withCounts(updated);
}

// ---------------------------------------------------------------------------
// Rate a marketplace template (upsert per LGU)
// ---------------------------------------------------------------------------

export interface RateTemplateInput {
  comment?: string;
  lguId: string;
  rating: number; // 1-5
  templateId: string;
}

export async function rateChecklistTemplate(
  input: RateTemplateInput,
): Promise<TemplateRating> {
  if (input.rating < 1 || input.rating > 5) {
    throw new AppError(422, "INVALID_RATING", "Rating must be between 1 and 5");
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: input.templateId },
  });

  if (!template || !template.isMarketplace) {
    throw new AppError(404, "NOT_FOUND", "Marketplace template not found");
  }

  const record = await prisma.checklistTemplateRating.upsert({
    create: {
      comment: input.comment?.trim() || null,
      lguId: input.lguId,
      rating: input.rating,
      templateId: input.templateId,
    },
    update: {
      comment: input.comment?.trim() || null,
      rating: input.rating,
    },
    where: {
      templateId_lguId: { lguId: input.lguId, templateId: input.templateId },
    },
  });

  return {
    comment: record.comment ?? undefined,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    lguId: record.lguId,
    rating: record.rating,
    templateId: record.templateId,
    updatedAt: record.updatedAt.toISOString(),
  };
}
