import type { AuthRole } from "../lib/auth-provider.js";
import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { normalizeUserRoleInput } from "../types/auth.js";

export interface PublicAuditLog {
  action:
    | "attachment.uploaded"
    | "auth.bootstrap_admin"
    | "auth.login"
    | "auth.register"
    | "auth.session_revoked"
    | "finding.created"
    | "finding.resolved"
    | "inspection.assigned"
    | "inspection.checklist_result_recorded"
    | "inspection.created"
    | "inspection.status_updated"
    | "payment.status_updated"
    | "reinspection.requested";
  actor?: {
    email: string;
    id: string;
    name: string;
    role: AuthRole;
  };
  createdAt: string;
  detail?: string;
  entityId?: string;
  entityType:
    | "attachment"
    | "checklist_result"
    | "finding"
    | "inspection"
    | "payment"
    | "user";
  id: string;
  summary: string;
}

interface AuditLogRecordRow {
  action: string;
  actor: {
    email: string;
    id: string;
    name: string;
    role: UserRole;
  } | null;
  createdAt: Date;
  detail: string | null;
  entityId: string | null;
  entityType: string;
  id: string;
  summary: string;
}

interface ListAuditLogsInput {
  action?: PublicAuditLog["action"];
  entityType?: PublicAuditLog["entityType"];
  limit: number;
  page: number;
  search?: string;
  skip: number;
}

interface RecordAuditLogInput {
  action: PublicAuditLog["action"];
  actorRole?: AuthRole;
  actorUserId?: string;
  detail?: string;
  entityId?: string;
  entityType: PublicAuditLog["entityType"];
  summary: string;
}

function mapActorRole(role: UserRole | null | undefined) {
  return role ? (normalizeUserRoleInput(role) ?? undefined) : undefined;
}

function toPublicAuditLog(log: AuditLogRecordRow): PublicAuditLog {
  return {
    action: log.action as PublicAuditLog["action"],
    actor: log.actor
      ? {
          email: log.actor.email,
          id: log.actor.id,
          name: log.actor.name,
          role: mapActorRole(log.actor.role) ?? "inspector",
        }
      : undefined,
    createdAt: log.createdAt.toISOString(),
    detail: log.detail ?? undefined,
    entityId: log.entityId ?? undefined,
    entityType: log.entityType as PublicAuditLog["entityType"],
    id: log.id,
    summary: log.summary,
  };
}

function buildAuditLogWhere(
  input: ListAuditLogsInput,
): Prisma.AuditLogWhereInput {
  const clauses: Prisma.AuditLogWhereInput[] = [];

  if (input.action) {
    clauses.push({ action: input.action });
  }

  if (input.entityType) {
    clauses.push({ entityType: input.entityType });
  }

  if (input.search?.trim()) {
    const value = input.search.trim();

    clauses.push({
      OR: [
        {
          actor: {
            email: { contains: value, mode: "insensitive" },
          },
        },
        {
          actor: {
            name: { contains: value, mode: "insensitive" },
          },
        },
        { detail: { contains: value, mode: "insensitive" } },
        { entityId: { contains: value, mode: "insensitive" } },
        { summary: { contains: value, mode: "insensitive" } },
      ],
    });
  }

  return clauses.length ? { AND: clauses } : {};
}

export async function recordAuditLog(
  input: RecordAuditLogInput,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      actorRole: input.actorRole
        ? (input.actorRole.toUpperCase() as UserRole)
        : null,
      actorUserId: input.actorUserId ?? null,
      detail: input.detail?.trim() || null,
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      summary: input.summary.trim(),
    },
  });
}

export async function listAuditLogs(input: ListAuditLogsInput): Promise<{
  data: PublicAuditLog[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildAuditLogWhere(input);
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      include: {
        actor: {
          select: {
            email: true,
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: logs.map((log: AuditLogRecordRow) => toPublicAuditLog(log)),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}
