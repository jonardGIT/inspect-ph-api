import type {
  DataSubjectRequestStatus,
  DataSubjectRequestType,
} from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface DataSubjectRequestRecord {
  id: string;
  type: Lowercase<`${DataSubjectRequestType}`>;
  status: Lowercase<`${DataSubjectRequestStatus}`>;
  requestedByUserId: string | null;
  email: string;
  description: string;
  response: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRecord(
  r: Awaited<ReturnType<typeof findRequest>>,
): DataSubjectRequestRecord {
  return {
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    description: r.description,
    email: r.email,
    id: r.id,
    requestedByUserId: r.requestedByUserId,
    response: r.response,
    status: r.status.toLowerCase() as Lowercase<`${DataSubjectRequestStatus}`>,
    type: r.type.toLowerCase() as Lowercase<`${DataSubjectRequestType}`>,
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function findRequest(id: string) {
  const record = await prisma.dataSubjectRequest.findUnique({ where: { id } });
  if (!record)
    throw new AppError(404, "NOT_FOUND", "Data subject request not found");
  return record;
}

export interface CreateDataSubjectRequestInput {
  type: DataSubjectRequestType;
  email: string;
  description: string;
  requestedByUserId?: string;
}

export async function createDataSubjectRequest(
  input: CreateDataSubjectRequestInput,
): Promise<DataSubjectRequestRecord> {
  const record = await prisma.dataSubjectRequest.create({
    data: {
      description: input.description,
      email: input.email.toLowerCase().trim(),
      requestedByUserId: input.requestedByUserId ?? null,
      type: input.type,
    },
  });
  return toRecord(record);
}

export interface ListDataSubjectRequestsFilters {
  limit: number;
  offset: number;
  status?: DataSubjectRequestStatus;
  type?: DataSubjectRequestType;
}

export async function listDataSubjectRequests(
  filters: ListDataSubjectRequestsFilters,
): Promise<{ records: DataSubjectRequestRecord[]; total: number }> {
  const where = {
    ...(filters.status && { status: filters.status }),
    ...(filters.type && { type: filters.type }),
  };

  const [records, total] = await prisma.$transaction([
    prisma.dataSubjectRequest.findMany({
      orderBy: { createdAt: "desc" },
      skip: filters.offset,
      take: filters.limit,
      where,
    }),
    prisma.dataSubjectRequest.count({ where }),
  ]);

  return { records: records.map(toRecord), total };
}

export async function getDataSubjectRequest(
  id: string,
): Promise<DataSubjectRequestRecord> {
  return toRecord(await findRequest(id));
}

export interface UpdateDataSubjectRequestInput {
  status: DataSubjectRequestStatus;
  response?: string;
}

const TERMINAL_STATUSES = new Set<DataSubjectRequestStatus>([
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
]);

export async function updateDataSubjectRequest(
  id: string,
  input: UpdateDataSubjectRequestInput,
): Promise<DataSubjectRequestRecord> {
  const existing = await findRequest(id);

  if (TERMINAL_STATUSES.has(existing.status)) {
    throw new AppError(
      409,
      "CONFLICT",
      `Cannot update a request in terminal status "${existing.status.toLowerCase()}"`,
    );
  }

  const isCompleting =
    input.status === "COMPLETED" || input.status === "REJECTED";

  const updated = await prisma.dataSubjectRequest.update({
    data: {
      completedAt: isCompleting ? new Date() : existing.completedAt,
      response: input.response ?? existing.response,
      status: input.status,
    },
    where: { id },
  });

  return toRecord(updated);
}
