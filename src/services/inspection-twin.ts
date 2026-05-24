import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";

export interface InspectionTwinSimulationInput {
  failOnCriticalSeverity: boolean;
  failOnHighSeverity: boolean;
  fromDate?: string;
  jurisdictionScope?: JurisdictionScope;
  lguId?: string;
  maxFailedChecklistItems: number;
  minChecklistPassRatePct: number;
  moduleCode?: string;
  officeId?: string;
  toDate?: string;
}

function parseTwinWindow(input: InspectionTwinSimulationInput) {
  const to = input.toDate ? new Date(input.toDate) : new Date();
  const from = input.fromDate
    ? new Date(input.fromDate)
    : (() => {
        const value = new Date(to);
        value.setDate(value.getDate() - 90);
        return value;
      })();

  return { from, to };
}

function buildInspectionTwinWhere(
  input: InspectionTwinSimulationInput,
): Prisma.InspectionWhereInput {
  const { from, to } = parseTwinWindow(input);

  const clauses: Prisma.InspectionWhereInput[] = [
    {
      scheduledAt: {
        gte: from,
        lte: to,
      },
      status: "COMPLETED",
    },
  ];

  if (input.moduleCode) {
    clauses.push({ moduleCode: input.moduleCode });
  }

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  } else if (input.lguId) {
    clauses.push({ office: { lguId: input.lguId } });
  }

  const scope = input.jurisdictionScope;

  if (scope?.accessScope === "office" || scope?.accessScope === "assigned") {
    clauses.push({ officeId: { in: scope.officeIds } });
  } else if (scope?.accessScope === "lgu") {
    clauses.push({ office: { lguId: { in: scope.lguIds } } });
  }

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

export async function getInspectionTwinSimulation(
  input: InspectionTwinSimulationInput,
) {
  const where = buildInspectionTwinWhere(input);
  const { from, to } = parseTwinWindow(input);

  const inspections = await prisma.inspection.findMany({
    include: {
      business: {
        select: {
          businessName: true,
          id: true,
        },
      },
      checklistResults: {
        select: {
          status: true,
        },
      },
      findings: {
        select: {
          severity: true,
        },
      },
      office: {
        select: {
          code: true,
          id: true,
          name: true,
        },
      },
      permitRecord: {
        select: {
          permitNumber: true,
        },
      },
    },
    orderBy: {
      scheduledAt: "desc",
    },
    where,
  });

  const reasonCounts = new Map<string, number>();

  const records = inspections.map((inspection) => {
    const applicableChecklist = inspection.checklistResults.filter(
      (result) => result.status !== "NOT_APPLICABLE",
    );
    const passedChecklistItems = applicableChecklist.filter(
      (result) => result.status === "PASS",
    ).length;
    const failedChecklistItems = applicableChecklist.filter(
      (result) => result.status === "FAIL",
    ).length;
    const checklistPassRatePct =
      applicableChecklist.length === 0
        ? 100
        : Math.round((passedChecklistItems / applicableChecklist.length) * 100);

    const highFindings = inspection.findings.filter(
      (finding) => finding.severity === "HIGH",
    ).length;
    const criticalFindings = inspection.findings.filter(
      (finding) => finding.severity === "CRITICAL",
    ).length;

    const reasons: string[] = [];

    if (checklistPassRatePct < input.minChecklistPassRatePct) {
      reasons.push(
        `Checklist pass rate below ${input.minChecklistPassRatePct}%`,
      );
    }

    if (failedChecklistItems > input.maxFailedChecklistItems) {
      reasons.push(
        `Failed checklist items above ${input.maxFailedChecklistItems}`,
      );
    }

    if (input.failOnHighSeverity && highFindings > 0) {
      reasons.push("Contains HIGH severity findings");
    }

    if (input.failOnCriticalSeverity && criticalFindings > 0) {
      reasons.push("Contains CRITICAL severity findings");
    }

    reasons.forEach((reason) => {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    });

    return {
      businessId: inspection.business.id,
      businessName: inspection.business.businessName,
      checklistPassRatePct,
      criticalFindings,
      failedChecklistItems,
      highFindings,
      inspectionId: inspection.id,
      moduleCode: inspection.moduleCode ?? undefined,
      officeCode: inspection.office.code,
      officeId: inspection.office.id,
      officeName: inspection.office.name,
      permitNumber: inspection.permitRecord.permitNumber,
      reasons,
      scheduledAt: inspection.scheduledAt.toISOString(),
      simulatedOutcome:
        reasons.length > 0 ? ("fail" as const) : ("pass" as const),
      totalChecklistItems: applicableChecklist.length,
    };
  });

  const simulatedFailedRecords = records.filter(
    (record) => record.simulatedOutcome === "fail",
  );
  const affectedBusinesses = new Set(
    simulatedFailedRecords.map((record) => record.businessId),
  ).size;

  return {
    affectedBusinesses,
    config: {
      failOnCriticalSeverity: input.failOnCriticalSeverity,
      failOnHighSeverity: input.failOnHighSeverity,
      fromDate: from.toISOString(),
      maxFailedChecklistItems: input.maxFailedChecklistItems,
      minChecklistPassRatePct: input.minChecklistPassRatePct,
      moduleCode: input.moduleCode,
      toDate: to.toISOString(),
    },
    failureRatePct:
      records.length === 0
        ? 0
        : Math.round((simulatedFailedRecords.length / records.length) * 100),
    inspectionsEvaluated: records.length,
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    records,
    simulatedFailedCount: simulatedFailedRecords.length,
    simulatedPassCount: records.length - simulatedFailedRecords.length,
    topReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ count, reason }))
      .sort((left, right) => right.count - left.count),
  };
}
