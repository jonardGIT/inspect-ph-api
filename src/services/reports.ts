import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface InspectionExportRow {
  id: string;
  officeCode: string;
  officeName: string;
  businessName: string;
  permitNumber: string;
  status: string;
  scheduledAt: string;
  startedAt: string;
  completedAt: string;
  inspectorId: string;
  createdAt: string;
}

export interface InspectionExportInput {
  fromDate?: string;
  officeId?: string;
  status?: string;
  toDate?: string;
}

function toCsvRow(row: InspectionExportRow): string {
  const fields = [
    row.id,
    row.officeCode,
    `"${row.officeName.replace(/"/g, '""')}"`,
    `"${row.businessName.replace(/"/g, '""')}"`,
    row.permitNumber,
    row.status,
    row.scheduledAt,
    row.startedAt,
    row.completedAt,
    row.inspectorId,
    row.createdAt,
  ];

  return fields.join(",");
}

const CSV_HEADER =
  "id,office_code,office_name,business_name,permit_number,status,scheduled_at,started_at,completed_at,inspector_id,created_at";

export async function exportInspectionsCsv(
  input: InspectionExportInput,
): Promise<string> {
  const clauses: Prisma.InspectionWhereInput[] = [];

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  }

  if (input.status) {
    clauses.push({
      status: input.status.toUpperCase() as Prisma.EnumInspectionStatusFilter,
    });
  }

  if (input.fromDate) {
    clauses.push({ createdAt: { gte: new Date(input.fromDate) } });
  }

  if (input.toDate) {
    clauses.push({ createdAt: { lte: new Date(input.toDate) } });
  }

  const where: Prisma.InspectionWhereInput =
    clauses.length === 0 ? {} : { AND: clauses };

  const inspections = await prisma.inspection.findMany({
    orderBy: { createdAt: "desc" },
    take: 10_000,
    where,
    include: {
      office: { select: { code: true, name: true } },
      business: { select: { businessName: true } },
      permitRecord: { select: { permitNumber: true } },
    },
  });

  const rows = inspections.map((insp) => {
    const row: InspectionExportRow = {
      businessName: insp.business?.businessName ?? "",
      completedAt: insp.completedAt?.toISOString() ?? "",
      createdAt: insp.createdAt.toISOString(),
      id: insp.id,
      inspectorId: insp.inspectorId ?? "",
      officeCode: insp.office?.code ?? "",
      officeName: insp.office?.name ?? "",
      permitNumber: insp.permitRecord?.permitNumber ?? "",
      scheduledAt: insp.scheduledAt.toISOString(),
      startedAt: insp.startedAt?.toISOString() ?? "",
      status: insp.status.toLowerCase(),
    };

    return toCsvRow(row);
  });

  return [CSV_HEADER, ...rows].join("\n");
}
