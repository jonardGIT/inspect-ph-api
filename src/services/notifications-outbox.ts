import type { AuthRole } from "../lib/auth-provider.js";
import type {
  NotificationChannel,
  NotificationOutboxStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { normalizeUserRoleInput } from "../types/auth.js";

export interface PublicNotificationOutboxEntry {
  body: string;
  channel: "in_app";
  createdAt: string;
  entityId?: string;
  entityType?: "inspection";
  eventType: "inspection.assigned" | "inspection.status_updated";
  id: string;
  recipient: {
    email: string;
    id: string;
    name: string;
    role: AuthRole;
  };
  status: "pending" | "processed" | "failed";
  title: string;
}

interface NotificationOutboxRow {
  body: string;
  channel: NotificationChannel;
  createdAt: Date;
  entityId: string | null;
  entityType: string | null;
  eventType: string;
  id: string;
  recipient: {
    email: string;
    id: string;
    name: string;
    role: UserRole;
  };
  status: NotificationOutboxStatus;
  title: string;
}

interface ListNotificationOutboxInput {
  eventType?: PublicNotificationOutboxEntry["eventType"];
  limit: number;
  page: number;
  search?: string;
  skip: number;
  status?: PublicNotificationOutboxEntry["status"];
}

interface UpdateNotificationOutboxStatusInput {
  id: string;
  status: PublicNotificationOutboxEntry["status"];
}

interface EnqueueNotificationInput {
  body: string;
  entityId?: string;
  entityType?: "inspection";
  eventType: PublicNotificationOutboxEntry["eventType"];
  recipientUserId: string;
  title: string;
}

function mapUserRole(role: UserRole) {
  return normalizeUserRoleInput(role) ?? "inspector";
}

function toPublicNotificationOutboxEntry(
  entry: NotificationOutboxRow,
): PublicNotificationOutboxEntry {
  return {
    body: entry.body,
    channel:
      entry.channel.toLowerCase() as PublicNotificationOutboxEntry["channel"],
    createdAt: entry.createdAt.toISOString(),
    entityId: entry.entityId ?? undefined,
    entityType:
      (entry.entityType as PublicNotificationOutboxEntry["entityType"]) ??
      undefined,
    eventType: entry.eventType as PublicNotificationOutboxEntry["eventType"],
    id: entry.id,
    recipient: {
      email: entry.recipient.email,
      id: entry.recipient.id,
      name: entry.recipient.name,
      role: mapUserRole(entry.recipient.role),
    },
    status:
      entry.status.toLowerCase() as PublicNotificationOutboxEntry["status"],
    title: entry.title,
  };
}

function buildNotificationOutboxWhere(
  input: ListNotificationOutboxInput,
): Prisma.NotificationOutboxWhereInput {
  const clauses: Prisma.NotificationOutboxWhereInput[] = [];

  if (input.eventType) {
    clauses.push({ eventType: input.eventType });
  }

  if (input.status) {
    clauses.push({
      status: input.status.toUpperCase() as NotificationOutboxStatus,
    });
  }

  if (input.search?.trim()) {
    const value = input.search.trim();

    clauses.push({
      OR: [
        { body: { contains: value, mode: "insensitive" } },
        { entityId: { contains: value, mode: "insensitive" } },
        { title: { contains: value, mode: "insensitive" } },
        { recipient: { email: { contains: value, mode: "insensitive" } } },
        { recipient: { name: { contains: value, mode: "insensitive" } } },
      ],
    });
  }

  return clauses.length ? { AND: clauses } : {};
}

export async function enqueueNotificationOutbox(
  input: EnqueueNotificationInput | EnqueueNotificationInput[],
): Promise<void> {
  const entries = Array.isArray(input) ? input : [input];

  if (entries.length === 0) {
    return;
  }

  await prisma.notificationOutbox.createMany({
    data: entries.map((entry) => ({
      body: entry.body.trim(),
      entityId: entry.entityId ?? null,
      entityType: entry.entityType ?? null,
      eventType: entry.eventType,
      recipientUserId: entry.recipientUserId,
      title: entry.title.trim(),
    })),
  });
}

export async function listNotificationOutbox(
  input: ListNotificationOutboxInput,
): Promise<{
  data: PublicNotificationOutboxEntry[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildNotificationOutboxWhere(input);
  const [total, entries] = await Promise.all([
    prisma.notificationOutbox.count({ where }),
    prisma.notificationOutbox.findMany({
      include: {
        recipient: {
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
    data: entries.map((entry) =>
      toPublicNotificationOutboxEntry(entry as NotificationOutboxRow),
    ),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function updateNotificationOutboxStatus(
  input: UpdateNotificationOutboxStatusInput,
): Promise<PublicNotificationOutboxEntry> {
  const existingEntry = await prisma.notificationOutbox.findUnique({
    where: { id: input.id },
    include: {
      recipient: {
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!existingEntry) {
    throw new Error("NOTIFICATION_OUTBOX_NOT_FOUND");
  }

  const updatedEntry = await prisma.notificationOutbox.update({
    where: { id: input.id },
    data: {
      status: input.status.toUpperCase() as NotificationOutboxStatus,
    },
    include: {
      recipient: {
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  return toPublicNotificationOutboxEntry(updatedEntry as NotificationOutboxRow);
}
