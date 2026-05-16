import { prisma } from "../lib/prisma.js";

const ATTRIBUTION =
  "Data provided by InspectPH (inspect.ph). Free to use with attribution. Not for commercial resale. Accuracy not guaranteed — verify with the issuing LGU before relying on this data.";

export interface OpenDataComplianceLgu {
  lguId: string;
  lguCode: string;
  lguName: string;
  region: string | null;
  province: string | null;
  city: string | null;
  avgComplianceScore: number;
  businessCount: number;
  gradeCounts: Record<string, number>;
}

export interface OpenDataComplianceResult {
  attribution: string;
  data: OpenDataComplianceLgu[];
  meta: { total: number };
}

export interface OpenDataInspectionsLgu {
  lguId: string;
  lguCode: string;
  lguName: string;
  region: string | null;
  province: string | null;
  city: string | null;
  total: number;
  completed: number;
  failed: number;
  passRate: number;
}

export interface OpenDataInspectionsResult {
  attribution: string;
  period: { from: string; to: string };
  data: OpenDataInspectionsLgu[];
  meta: { total: number };
}

export interface OpenDataFeesLgu {
  lguId: string;
  lguCode: string;
  lguName: string;
  region: string | null;
  province: string | null;
  city: string | null;
  totalCollectedInMinor: number;
  totalCollectedCount: number;
}

export interface OpenDataFeesResult {
  attribution: string;
  period: { from: string; to: string };
  data: OpenDataFeesLgu[];
  meta: { total: number };
}

// ─── Compliance ──────────────────────────────────────────────────────────────

export async function getOpenDataCompliance(params: {
  lguId?: string;
  region?: string;
  province?: string;
}): Promise<OpenDataComplianceResult> {
  const lgus = await prisma.lgu.findMany({
    where: {
      archivedAt: null,
      ...(params.lguId ? { id: params.lguId } : {}),
      ...(params.region
        ? { region: { equals: params.region, mode: "insensitive" } }
        : {}),
      ...(params.province
        ? { province: { equals: params.province, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      region: true,
      province: true,
      city: true,
    },
    orderBy: [{ region: "asc" }, { province: "asc" }, { name: "asc" }],
  });

  // For each LGU, aggregate compliance via inspection outcomes as a proxy.
  // "Pass" means the inspection completed with no open CRITICAL findings.
  const result: OpenDataComplianceLgu[] = await Promise.all(
    lgus.map(async (lgu) => {
      const businesses = await prisma.businessEstablishment.findMany({
        where: {
          archivedAt: null,
          inspections: { some: { office: { lguId: lgu.id } } },
        },
        select: { id: true },
      });

      const businessIds = businesses.map((b) => b.id);
      const total = businessIds.length;

      if (total === 0) {
        return {
          lguId: lgu.id,
          lguCode: lgu.code,
          lguName: lgu.name,
          region: lgu.region,
          province: lgu.province,
          city: lgu.city,
          avgComplianceScore: 0,
          businessCount: 0,
          gradeCounts: {},
        };
      }

      // Use last-12-months completed inspections to derive a compliance proxy.
      const since = new Date();
      since.setFullYear(since.getFullYear() - 1);

      const inspections = await prisma.inspection.findMany({
        where: {
          businessId: { in: businessIds },
          status: "COMPLETED",
          completedAt: { gte: since },
        },
        select: {
          businessId: true,
          findings: {
            where: { resolvedAt: null, severity: "CRITICAL" },
            select: { id: true },
          },
        },
      });

      // Group by business: score = 100 if no open critical findings, else 60.
      const scoreByBusiness = new Map<string, number>();
      for (const insp of inspections) {
        const existing = scoreByBusiness.get(insp.businessId) ?? -1;
        const score = insp.findings.length === 0 ? 100 : 60;
        if (score > existing) {
          scoreByBusiness.set(insp.businessId, score);
        }
      }

      const scores = Array.from(scoreByBusiness.values());
      const avgComplianceScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

      const gradeCounts: Record<string, number> = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        F: 0,
      };
      for (const s of scores) {
        if (s >= 90) gradeCounts["A"] = (gradeCounts["A"] ?? 0) + 1;
        else if (s >= 75) gradeCounts["B"] = (gradeCounts["B"] ?? 0) + 1;
        else if (s >= 60) gradeCounts["C"] = (gradeCounts["C"] ?? 0) + 1;
        else if (s >= 50) gradeCounts["D"] = (gradeCounts["D"] ?? 0) + 1;
        else gradeCounts["F"] = (gradeCounts["F"] ?? 0) + 1;
      }

      return {
        lguId: lgu.id,
        lguCode: lgu.code,
        lguName: lgu.name,
        region: lgu.region,
        province: lgu.province,
        city: lgu.city,
        avgComplianceScore,
        businessCount: total,
        gradeCounts,
      };
    }),
  );

  return {
    attribution: ATTRIBUTION,
    data: result,
    meta: { total: result.length },
  };
}

// ─── Inspections ─────────────────────────────────────────────────────────────

export async function getOpenDataInspections(params: {
  lguId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<OpenDataInspectionsResult> {
  const from = params.fromDate
    ? new Date(params.fromDate)
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 12);
        return d;
      })();
  const to = params.toDate ? new Date(params.toDate) : new Date();

  const lgus = await prisma.lgu.findMany({
    where: {
      archivedAt: null,
      ...(params.lguId ? { id: params.lguId } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      region: true,
      province: true,
      city: true,
    },
    orderBy: [{ region: "asc" }, { name: "asc" }],
  });

  const result: OpenDataInspectionsLgu[] = await Promise.all(
    lgus.map(async (lgu) => {
      const offices = await prisma.office.findMany({
        where: { lguId: lgu.id, archivedAt: null },
        select: { id: true },
      });
      const officeIds = offices.map((o) => o.id);

      const [total, completed, failed] = await Promise.all([
        prisma.inspection.count({
          where: {
            officeId: { in: officeIds },
            scheduledAt: { gte: from, lte: to },
          },
        }),
        prisma.inspection.count({
          where: {
            officeId: { in: officeIds },
            status: "COMPLETED",
            scheduledAt: { gte: from, lte: to },
          },
        }),
        prisma.inspection.count({
          where: {
            officeId: { in: officeIds },
            status: "COMPLETED",
            scheduledAt: { gte: from, lte: to },
            findings: {
              some: {
                severity: "CRITICAL",
                resolvedAt: null,
              },
            },
          },
        }),
      ]);

      const passRate =
        completed > 0
          ? Math.round(((completed - failed) / completed) * 100)
          : 0;

      return {
        lguId: lgu.id,
        lguCode: lgu.code,
        lguName: lgu.name,
        region: lgu.region,
        province: lgu.province,
        city: lgu.city,
        total,
        completed,
        failed,
        passRate,
      };
    }),
  );

  return {
    attribution: ATTRIBUTION,
    period: { from: from.toISOString(), to: to.toISOString() },
    data: result,
    meta: { total: result.length },
  };
}

// ─── Fees ─────────────────────────────────────────────────────────────────────

export async function getOpenDataFees(params: {
  lguId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<OpenDataFeesResult> {
  const from = params.fromDate
    ? new Date(params.fromDate)
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 12);
        return d;
      })();
  const to = params.toDate ? new Date(params.toDate) : new Date();

  const lgus = await prisma.lgu.findMany({
    where: {
      archivedAt: null,
      ...(params.lguId ? { id: params.lguId } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      region: true,
      province: true,
      city: true,
    },
    orderBy: [{ region: "asc" }, { name: "asc" }],
  });

  const result: OpenDataFeesLgu[] = await Promise.all(
    lgus.map(async (lgu) => {
      const offices = await prisma.office.findMany({
        where: { lguId: lgu.id, archivedAt: null },
        select: { id: true },
      });
      const officeIds = offices.map((o) => o.id);

      // Payments are on PermitRecord → Inspection → Office
      // Join via permitRecord → inspections → office
      const payments = await prisma.paymentRecord.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: from, lte: to },
          permitRecord: {
            inspections: {
              some: { officeId: { in: officeIds } },
            },
          },
        },
        select: { amountInMinor: true },
      });

      const totalCollectedInMinor = payments.reduce(
        (sum, p) => sum + p.amountInMinor,
        0,
      );

      return {
        lguId: lgu.id,
        lguCode: lgu.code,
        lguName: lgu.name,
        region: lgu.region,
        province: lgu.province,
        city: lgu.city,
        totalCollectedInMinor,
        totalCollectedCount: payments.length,
      };
    }),
  );

  return {
    attribution: ATTRIBUTION,
    period: { from: from.toISOString(), to: to.toISOString() },
    data: result,
    meta: { total: result.length },
  };
}
