import { randomUUID } from "node:crypto";

import type {
  IssueReportCategory,
  IssueReportStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface PublicIssueReport {
  id: string;
  reportNumber: string;
  category: Lowercase<`${IssueReportCategory}`>;
  subject: string;
  description: string;
  locationDescription?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  status: Lowercase<`${IssueReportStatus}`>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublicIssueReportInput {
  category: IssueReportCategory;
  subject: string;
  description: string;
  locationDescription?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
}

export interface ListIssueReportsInput {
  category?: IssueReportCategory;
  limit: number;
  page: number;
  search?: string;
  skip: number;
  status?: IssueReportStatus;
}

export interface UpdateIssueReportStatusInput {
  id: string;
  status: IssueReportStatus;
}

type IssueReportRecord = Prisma.IssueReportGetPayload<Record<string, never>>;

function createIssueReportNumber() {
  const date = new Date();
  const dateSegment = `${date.getUTCFullYear()}${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;

  return `IR-${dateSegment}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function toPublicIssueReport(record: IssueReportRecord): PublicIssueReport {
  return {
    category: record.category.toLowerCase() as Lowercase<`${IssueReportCategory}`>,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    id: record.id,
    location:
      record.locationLatitude !== null && record.locationLongitude !== null
        ? {
            accuracyMeters: record.locationAccuracyMeters ?? undefined,
            latitude: record.locationLatitude,
            longitude: record.locationLongitude,
          }
        : undefined,
    locationDescription: record.locationDescription ?? undefined,
    reportNumber: record.reportNumber,
    reporterEmail: record.reporterEmail ?? undefined,
    reporterName: record.reporterName ?? undefined,
    reporterPhone: record.reporterPhone ?? undefined,
    status: record.status.toLowerCase() as Lowercase<`${IssueReportStatus}`>,
    subject: record.subject,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildIssueReportWhere(input: ListIssueReportsInput) {
  const clauses: Prisma.IssueReportWhereInput[] = [];

  if (input.category) {
    clauses.push({ category: input.category });
  }

  if (input.status) {
    clauses.push({ status: input.status });
  }

  if (input.search) {
    const value = input.search.trim();

    clauses.push({
      OR: [
        { reportNumber: { contains: value, mode: "insensitive" } },
        { subject: { contains: value, mode: "insensitive" } },
        { description: { contains: value, mode: "insensitive" } },
        { locationDescription: { contains: value, mode: "insensitive" } },
        { reporterName: { contains: value, mode: "insensitive" } },
        { reporterEmail: { contains: value, mode: "insensitive" } },
        { reporterPhone: { contains: value, mode: "insensitive" } },
      ],
    });
  }

  return clauses.length ? { AND: clauses } : {};
}

export async function listIssueReports(input: ListIssueReportsInput): Promise<{
  data: PublicIssueReport[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildIssueReportWhere(input);

  const [total, records] = await Promise.all([
    prisma.issueReport.count({ where }),
    prisma.issueReport.findMany({
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: records.map(toPublicIssueReport),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function createPublicIssueReport(
  input: CreatePublicIssueReportInput,
): Promise<PublicIssueReport> {
  const record = await prisma.issueReport.create({
    data: {
      category: input.category,
      description: input.description.trim(),
      locationAccuracyMeters: input.location?.accuracyMeters ?? null,
      locationDescription: input.locationDescription?.trim() || null,
      locationLatitude: input.location?.latitude ?? null,
      locationLongitude: input.location?.longitude ?? null,
      reportNumber: createIssueReportNumber(),
      reporterEmail: input.reporterEmail?.trim() || null,
      reporterName: input.reporterName?.trim() || null,
      reporterPhone: input.reporterPhone?.trim() || null,
      subject: input.subject.trim(),
    },
  });

  return toPublicIssueReport(record);
}

export async function updateIssueReportStatus(
  input: UpdateIssueReportStatusInput,
): Promise<PublicIssueReport> {
  const existing = await prisma.issueReport.findUnique({
    where: { id: input.id },
  });

  if (!existing) {
    throw new Error("ISSUE_REPORT_NOT_FOUND");
  }

  const updated = await prisma.issueReport.update({
    data: { status: input.status },
    where: { id: input.id },
  });

  return toPublicIssueReport(updated);
}

export async function getPublicIssueReportByNumber(input: {
  reportNumber: string;
}): Promise<PublicIssueReport> {
  const record = await prisma.issueReport.findUnique({
    where: { reportNumber: input.reportNumber },
  });

  if (!record) {
    throw new Error("ISSUE_REPORT_NOT_FOUND");
  }

  return toPublicIssueReport(record);
}