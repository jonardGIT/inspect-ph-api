import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { prisma } from "../lib/prisma.js";

export interface KpiReportInput {
  fromDate?: string;
  toDate?: string;
  lguId?: string;
  officeId?: string;
  jurisdictionScope?: JurisdictionScope;
}

export interface KpiTrendEntry {
  month: string; // "YYYY-MM"
  total: number;
  completed: number;
  passRate: number;
}

export interface KpiModuleEntry {
  officeCode: string;
  officeName: string;
  total: number;
  completed: number;
  passRate: number;
}

export interface KpiReport {
  period: { from: string; to: string };
  inspections: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    passRate: number;
  };
  findings: {
    total: number;
    resolved: number;
    resolvedRate: number;
    criticalOpen: number;
  };
  payments: {
    totalCollectedInMinor: number;
    totalCollectedCount: number;
    totalPendingInMinor: number;
    totalPendingCount: number;
  };
  byOffice: KpiModuleEntry[];
  trend: KpiTrendEntry[];
}

function buildInspectionWhere(input: KpiReportInput): object {
  const clauses: object[] = [];

  const from = input.fromDate
    ? new Date(input.fromDate)
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 12);
        return d;
      })();
  const to = input.toDate ? new Date(input.toDate) : new Date();

  clauses.push({ scheduledAt: { gte: from, lte: to } });

  const effectiveLguId =
    input.lguId ?? input.jurisdictionScope?.lguIds[0] ?? undefined;

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  } else if (effectiveLguId) {
    clauses.push({ office: { lguId: effectiveLguId } });
  }

  return { AND: clauses };
}

export async function getKpiReport(input: KpiReportInput): Promise<KpiReport> {
  const from = input.fromDate
    ? new Date(input.fromDate)
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 12);
        return d;
      })();
  const to = input.toDate ? new Date(input.toDate) : new Date();

  const inspectionWhere = buildInspectionWhere(input);

  // ── Inspection counts ─────────────────────────────────────────────────────
  const [
    totalInspections,
    completedInspections,
    inProgressInspections,
    overdueInspections,
  ] = await Promise.all([
    prisma.inspection.count({ where: inspectionWhere }),
    prisma.inspection.count({
      where: { ...inspectionWhere, status: "COMPLETED" },
    }),
    prisma.inspection.count({
      where: { ...inspectionWhere, status: "IN_PROGRESS" },
    }),
    prisma.inspection.count({
      where: { ...inspectionWhere, status: "OVERDUE" },
    }),
  ]);

  const passRate =
    totalInspections === 0
      ? 0
      : Math.round((completedInspections / totalInspections) * 100);

  // ── Findings ──────────────────────────────────────────────────────────────
  const [totalFindings, resolvedFindings, criticalOpen] = await Promise.all([
    prisma.finding.count({ where: { inspection: inspectionWhere } }),
    prisma.finding.count({
      where: { inspection: inspectionWhere, resolvedAt: { not: null } },
    }),
    prisma.finding.count({
      where: {
        inspection: inspectionWhere,
        severity: "CRITICAL",
        resolvedAt: null,
      },
    }),
  ]);

  const resolvedRate =
    totalFindings === 0
      ? 100
      : Math.round((resolvedFindings / totalFindings) * 100);

  // ── Payments ──────────────────────────────────────────────────────────────
  const effectiveLguIdPayment =
    input.lguId ?? input.jurisdictionScope?.lguIds[0] ?? undefined;
  const lguFilter =
    input.officeId || effectiveLguIdPayment
      ? {
          permitRecord: {
            inspections: {
              some: input.officeId
                ? { officeId: input.officeId }
                : { office: { lguId: effectiveLguIdPayment } },
            },
          },
        }
      : {};

  const paidPayments = await prisma.paymentRecord.aggregate({
    _sum: { amountInMinor: true },
    _count: { id: true },
    where: { status: "PAID", paidAt: { gte: from, lte: to }, ...lguFilter },
  });

  const pendingPayments = await prisma.paymentRecord.aggregate({
    _sum: { amountInMinor: true },
    _count: { id: true },
    where: {
      status: "PENDING",
      createdAt: { gte: from, lte: to },
      ...lguFilter,
    },
  });

  // ── By-office breakdown ───────────────────────────────────────────────────
  const officeRows = await prisma.office.findMany({
    select: {
      code: true,
      name: true,
      _count: { select: { inspections: true } },
    },
    where: {
      archivedAt: null,
      ...(input.officeId ? { id: input.officeId } : {}),
      ...(input.lguId ? { lguId: input.lguId } : {}),
      ...(input.jurisdictionScope?.lguIds[0] && !input.lguId
        ? { lguId: input.jurisdictionScope.lguIds[0] }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const byOffice = await Promise.all(
    officeRows.map(async (office) => {
      const [officeTotal, officeCompleted] = await Promise.all([
        prisma.inspection.count({
          where: {
            office: { code: office.code },
            scheduledAt: { gte: from, lte: to },
          },
        }),
        prisma.inspection.count({
          where: {
            office: { code: office.code },
            scheduledAt: { gte: from, lte: to },
            status: "COMPLETED",
          },
        }),
      ]);
      return {
        officeCode: office.code,
        officeName: office.name,
        total: officeTotal,
        completed: officeCompleted,
        passRate:
          officeTotal === 0
            ? 0
            : Math.round((officeCompleted / officeTotal) * 100),
      };
    }),
  );

  // ── 12-month trend (monthly buckets) ──────────────────────────────────────
  const trendMonths: KpiTrendEntry[] = [];
  const cursor = new Date(from);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= to) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const [mTotal, mCompleted] = await Promise.all([
      prisma.inspection.count({
        where: {
          ...buildInspectionWhere({
            ...input,
            fromDate: monthStart.toISOString(),
            toDate: monthEnd.toISOString(),
          }),
        },
      }),
      prisma.inspection.count({
        where: {
          ...buildInspectionWhere({
            ...input,
            fromDate: monthStart.toISOString(),
            toDate: monthEnd.toISOString(),
          }),
          status: "COMPLETED",
        },
      }),
    ]);

    trendMonths.push({
      month: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      total: mTotal,
      completed: mCompleted,
      passRate: mTotal === 0 ? 0 : Math.round((mCompleted / mTotal) * 100),
    });

    cursor.setMonth(cursor.getMonth() + 1);
    if (trendMonths.length >= 13) break; // safety cap
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    inspections: {
      total: totalInspections,
      completed: completedInspections,
      inProgress: inProgressInspections,
      overdue: overdueInspections,
      passRate,
    },
    findings: {
      total: totalFindings,
      resolved: resolvedFindings,
      resolvedRate,
      criticalOpen,
    },
    payments: {
      totalCollectedInMinor: paidPayments._sum.amountInMinor ?? 0,
      totalCollectedCount: paidPayments._count.id,
      totalPendingInMinor: pendingPayments._sum.amountInMinor ?? 0,
      totalPendingCount: pendingPayments._count.id,
    },
    byOffice,
    trend: trendMonths,
  };
}
