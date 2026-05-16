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

// ---------------------------------------------------------------------------
// Payment Reconciliation Report
// ---------------------------------------------------------------------------

export interface PaymentReconciliationByOffice {
  officeId: string;
  officeName: string;
  officeCode: string;
  lguId: string;
  paidCount: number;
  paidAmountInMinor: number;
  unpaidCount: number;
  unpaidAmountInMinor: number;
}

export interface PaymentReconciliationReport {
  fromDate: string;
  toDate: string;
  totalPaidCount: number;
  totalPaidAmountInMinor: number;
  totalUnpaidCount: number;
  totalUnpaidAmountInMinor: number;
  agingUnpaidCount: number;
  agingUnpaidAmountInMinor: number;
  byOffice: PaymentReconciliationByOffice[];
}

export interface PaymentReconciliationInput {
  fromDate?: string;
  toDate?: string;
  lguId?: string;
  officeId?: string;
}

export async function getPaymentReconciliation(
  input: PaymentReconciliationInput,
): Promise<PaymentReconciliationReport> {
  const from = input.fromDate ? new Date(input.fromDate) : new Date(0);
  const to = input.toDate ? new Date(input.toDate) : new Date();

  // 7-day aging threshold for unpaid
  const agingThreshold = new Date(to);
  agingThreshold.setDate(agingThreshold.getDate() - 7);

  const baseWhere: Prisma.PaymentRecordWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(input.lguId
      ? {
          permitRecord: {
            inspections: { some: { office: { lguId: input.lguId } } },
          },
        }
      : {}),
    ...(input.officeId
      ? {
          permitRecord: {
            inspections: { some: { officeId: input.officeId } },
          },
        }
      : {}),
  };

  const [paidRecords, unpaidRecords] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        ...baseWhere,
        status: "PAID",
      },
      select: {
        amountInMinor: true,
        permitRecord: {
          select: {
            inspections: {
              take: 1,
              select: {
                office: {
                  select: { id: true, code: true, name: true, lguId: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.paymentRecord.findMany({
      where: {
        ...baseWhere,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      select: {
        amountInMinor: true,
        createdAt: true,
        permitRecord: {
          select: {
            inspections: {
              take: 1,
              select: {
                office: {
                  select: { id: true, code: true, name: true, lguId: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Aggregate by office
  const officeMap = new Map<string, PaymentReconciliationByOffice>();

  function upsertOffice(
    officeId: string,
    code: string,
    name: string,
    lguId: string,
  ) {
    if (!officeMap.has(officeId)) {
      officeMap.set(officeId, {
        lguId,
        officeCode: code,
        officeId,
        officeName: name,
        paidAmountInMinor: 0,
        paidCount: 0,
        unpaidAmountInMinor: 0,
        unpaidCount: 0,
      });
    }
    return officeMap.get(officeId)!;
  }

  for (const r of paidRecords) {
    const insp = r.permitRecord.inspections[0];
    if (!insp) continue;
    const row = upsertOffice(
      insp.office.id,
      insp.office.code,
      insp.office.name,
      insp.office.lguId,
    );
    row.paidCount += 1;
    row.paidAmountInMinor += r.amountInMinor;
  }

  let agingCount = 0;
  let agingAmount = 0;

  for (const r of unpaidRecords) {
    const insp = r.permitRecord.inspections[0];
    if (!insp) continue;
    const row = upsertOffice(
      insp.office.id,
      insp.office.code,
      insp.office.name,
      insp.office.lguId,
    );
    row.unpaidCount += 1;
    row.unpaidAmountInMinor += r.amountInMinor;

    if (r.createdAt < agingThreshold) {
      agingCount += 1;
      agingAmount += r.amountInMinor;
    }
  }

  const byOffice = Array.from(officeMap.values()).sort((a, b) =>
    a.officeName.localeCompare(b.officeName),
  );

  const totalPaidCount = paidRecords.length;
  const totalPaidAmountInMinor = paidRecords.reduce(
    (s, r) => s + r.amountInMinor,
    0,
  );
  const totalUnpaidCount = unpaidRecords.length;
  const totalUnpaidAmountInMinor = unpaidRecords.reduce(
    (s, r) => s + r.amountInMinor,
    0,
  );

  return {
    agingUnpaidAmountInMinor: agingAmount,
    agingUnpaidCount: agingCount,
    byOffice,
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
    totalPaidAmountInMinor,
    totalPaidCount,
    totalUnpaidAmountInMinor,
    totalUnpaidCount,
  };
}

// ---------------------------------------------------------------------------
// Treasurer Fee Collection Report
// ---------------------------------------------------------------------------

export interface TreasurerAgingReceivable {
  paymentId: string;
  referenceNumber: string;
  businessName: string;
  permitNumber: string;
  amountInMinor: number;
  createdAt: string;
  daysOverdue: number;
}

export interface TreasurerDailyEntry {
  date: string; // YYYY-MM-DD
  collectedAmountInMinor: number;
  paymentCount: number;
}

export interface TreasurerByOffice {
  officeId: string;
  officeName: string;
  officeCode: string;
  lguId: string;
  collectedAmountInMinor: number;
  collectedCount: number;
  pendingAmountInMinor: number;
  pendingCount: number;
}

export interface TreasurerReport {
  fromDate: string;
  toDate: string;
  totalCollectedAmountInMinor: number;
  totalCollectedCount: number;
  totalPendingAmountInMinor: number;
  totalPendingCount: number;
  agingReceivablesCount: number;
  agingReceivablesAmountInMinor: number;
  dailyTrend: TreasurerDailyEntry[];
  byOffice: TreasurerByOffice[];
  agingReceivablesList: TreasurerAgingReceivable[];
}

export interface TreasurerReportInput {
  fromDate?: string;
  toDate?: string;
  officeId?: string;
  lguId?: string;
}

export async function getTreasurerReport(
  input: TreasurerReportInput,
): Promise<TreasurerReport> {
  const from = input.fromDate ? new Date(input.fromDate) : new Date(0);
  const to = input.toDate ? new Date(input.toDate) : new Date();

  // Aging threshold: unpaid for more than 7 days
  const agingCutoff = new Date();
  agingCutoff.setDate(agingCutoff.getDate() - 7);

  const officeFilter: Prisma.PaymentRecordWhereInput =
    input.officeId || input.lguId
      ? {
          permitRecord: {
            inspections: {
              some: {
                ...(input.officeId ? { officeId: input.officeId } : {}),
                ...(input.lguId ? { office: { lguId: input.lguId } } : {}),
              },
            },
          },
        }
      : {};

  const [paidRecords, pendingRecords] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        ...officeFilter,
        status: "PAID",
        paidAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        amountInMinor: true,
        paidAt: true,
        permitRecord: {
          select: {
            inspections: {
              take: 1,
              select: {
                office: {
                  select: { id: true, code: true, name: true, lguId: true },
                },
              },
            },
          },
        },
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.paymentRecord.findMany({
      where: {
        ...officeFilter,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      select: {
        id: true,
        referenceNumber: true,
        amountInMinor: true,
        createdAt: true,
        permitRecord: {
          select: {
            permitNumber: true,
            business: { select: { businessName: true } },
            inspections: {
              take: 1,
              select: {
                office: {
                  select: { id: true, code: true, name: true, lguId: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Build daily trend map keyed by date string (YYYY-MM-DD)
  const dailyMap = new Map<string, TreasurerDailyEntry>();

  for (const r of paidRecords) {
    const date = (r.paidAt ?? new Date()).toISOString().slice(0, 10);
    const entry = dailyMap.get(date) ?? {
      collectedAmountInMinor: 0,
      date,
      paymentCount: 0,
    };
    entry.collectedAmountInMinor += r.amountInMinor;
    entry.paymentCount += 1;
    dailyMap.set(date, entry);
  }

  // Build by-office aggregation
  const officeMap = new Map<string, TreasurerByOffice>();

  function upsertOfficeRow(
    officeId: string,
    code: string,
    name: string,
    lguId: string,
  ) {
    if (!officeMap.has(officeId)) {
      officeMap.set(officeId, {
        collectedAmountInMinor: 0,
        collectedCount: 0,
        lguId,
        officeCode: code,
        officeId,
        officeName: name,
        pendingAmountInMinor: 0,
        pendingCount: 0,
      });
    }
    return officeMap.get(officeId)!;
  }

  for (const r of paidRecords) {
    const insp = r.permitRecord.inspections[0];
    if (!insp) continue;
    const row = upsertOfficeRow(
      insp.office.id,
      insp.office.code,
      insp.office.name,
      insp.office.lguId,
    );
    row.collectedCount += 1;
    row.collectedAmountInMinor += r.amountInMinor;
  }

  const agingReceivablesList: TreasurerAgingReceivable[] = [];

  for (const r of pendingRecords) {
    const insp = r.permitRecord.inspections[0];
    if (!insp) continue;
    const row = upsertOfficeRow(
      insp.office.id,
      insp.office.code,
      insp.office.name,
      insp.office.lguId,
    );
    row.pendingCount += 1;
    row.pendingAmountInMinor += r.amountInMinor;

    if (r.createdAt < agingCutoff) {
      const daysOverdue = Math.floor(
        (Date.now() - r.createdAt.getTime()) / 86_400_000,
      );
      agingReceivablesList.push({
        amountInMinor: r.amountInMinor,
        businessName: r.permitRecord.business.businessName,
        createdAt: r.createdAt.toISOString(),
        daysOverdue,
        paymentId: r.id,
        permitNumber: r.permitRecord.permitNumber,
        referenceNumber: r.referenceNumber,
      });
    }
  }

  agingReceivablesList.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const byOffice = Array.from(officeMap.values()).sort((a, b) =>
    a.officeName.localeCompare(b.officeName),
  );

  const totalCollectedAmountInMinor = paidRecords.reduce(
    (s, r) => s + r.amountInMinor,
    0,
  );
  const totalPendingAmountInMinor = pendingRecords.reduce(
    (s, r) => s + r.amountInMinor,
    0,
  );
  const agingAmount = agingReceivablesList.reduce(
    (s, r) => s + r.amountInMinor,
    0,
  );

  return {
    agingReceivablesAmountInMinor: agingAmount,
    agingReceivablesCount: agingReceivablesList.length,
    agingReceivablesList,
    byOffice,
    dailyTrend,
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
    totalCollectedAmountInMinor,
    totalCollectedCount: paidRecords.length,
    totalPendingAmountInMinor,
    totalPendingCount: pendingRecords.length,
  };
}
