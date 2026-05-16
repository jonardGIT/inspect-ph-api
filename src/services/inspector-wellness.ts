import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { prisma } from "../lib/prisma.js";

export interface InspectorWellnessReport {
  period: { from: string; to: string };
  activeInspectorCount: number;
  avgInspectionsPerInspector: number;
  avgDurationMinutes: number | null;
  medianDurationMinutes: number | null;
  afterHoursRatePct: number;
  avgPendingQueuePerInspector: number;
}

/** 8:00–17:00 Monday–Friday is "in hours" */
function isAfterHours(date: Date): boolean {
  const day = date.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return true;
  const hour = date.getHours();
  return hour < 8 || hour >= 17;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
}

function buildOfficeWhere(input: {
  lguId?: string;
  jurisdictionScope?: JurisdictionScope;
}): object | undefined {
  const effectiveLguId =
    input.lguId ?? input.jurisdictionScope?.lguIds[0] ?? undefined;
  if (!effectiveLguId) return undefined;
  return { lguId: effectiveLguId };
}

export async function getInspectorWellnessReport(input: {
  fromDate?: string;
  toDate?: string;
  lguId?: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<InspectorWellnessReport> {
  const from = input.fromDate
    ? new Date(input.fromDate)
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return d;
      })();
  const to = input.toDate ? new Date(input.toDate) : new Date();

  const officeWhere = buildOfficeWhere(input);

  // Inspections with at least a startedAt in the period, with an assigned inspector
  const inspections = await prisma.inspection.findMany({
    select: {
      inspectorId: true,
      startedAt: true,
      completedAt: true,
      status: true,
    },
    where: {
      ...(officeWhere ? { office: officeWhere } : {}),
      inspectorId: { not: null },
      scheduledAt: { gte: from, lte: to },
    },
  });

  // Distinct active inspectors (with at least one inspection in the period)
  const inspectorIds = new Set(
    inspections
      .map((i) => i.inspectorId)
      .filter((id): id is string => id !== null),
  );
  const activeInspectorCount = inspectorIds.size;

  if (activeInspectorCount === 0) {
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      activeInspectorCount: 0,
      avgInspectionsPerInspector: 0,
      avgDurationMinutes: null,
      medianDurationMinutes: null,
      afterHoursRatePct: 0,
      avgPendingQueuePerInspector: 0,
    };
  }

  // Avg inspections per inspector
  const avgInspectionsPerInspector =
    Math.round((inspections.length / activeInspectorCount) * 10) / 10;

  // Duration: only completed inspections with both startedAt and completedAt
  const durations: number[] = inspections
    .filter((i) => i.startedAt && i.completedAt)
    .map(
      (i) => (i.completedAt!.getTime() - i.startedAt!.getTime()) / (1000 * 60),
    )
    .filter((d) => d >= 0 && d <= 480) // cap at 8 hours to exclude outliers
    .sort((a, b) => a - b);

  const avgDurationMinutes =
    durations.length === 0
      ? null
      : Math.round(
          (durations.reduce((s, d) => s + d, 0) / durations.length) * 10,
        ) / 10;

  const medianDurationMinutes = median(durations);

  // After-hours: inspections where startedAt is outside working hours
  const startedInspections = inspections.filter((i) => i.startedAt);
  const afterHoursCount = startedInspections.filter((i) =>
    isAfterHours(i.startedAt!),
  ).length;
  const afterHoursRatePct =
    startedInspections.length === 0
      ? 0
      : Math.round((afterHoursCount / startedInspections.length) * 100);

  // Pending queue: SCHEDULED or IN_PROGRESS inspections currently unfinished
  const pendingCount = await prisma.inspection.count({
    where: {
      ...(officeWhere ? { office: officeWhere } : {}),
      inspectorId: { in: [...inspectorIds] },
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
  });
  const avgPendingQueuePerInspector =
    Math.round((pendingCount / activeInspectorCount) * 10) / 10;

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    activeInspectorCount,
    avgInspectionsPerInspector,
    avgDurationMinutes,
    medianDurationMinutes,
    afterHoursRatePct,
    avgPendingQueuePerInspector,
  };
}
