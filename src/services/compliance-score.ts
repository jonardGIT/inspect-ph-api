import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

// Weights must sum to 1
const WEIGHT_FINDINGS = 0.4;
const WEIGHT_ATTENDANCE = 0.3;
const WEIGHT_CHECKLIST = 0.2;
const WEIGHT_PAYMENT = 0.1;

export interface ComplianceScoreBreakdown {
  findings: { score: number; resolved: number; total: number };
  inspectionAttendance: { score: number; attended: number; total: number };
  checklistCompliance: { score: number; passed: number; total: number };
  paymentCompliance: { score: number; paidOnTime: number; total: number };
}

export interface ComplianceScoreResult {
  businessId: string;
  businessName: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: ComplianceScoreBreakdown;
  computedAt: string;
  period: { from: string; to: string };
}

function toGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export async function computeComplianceScore(
  businessId: string,
): Promise<ComplianceScoreResult> {
  const business = await prisma.businessEstablishment.findUnique({
    where: { id: businessId },
  });
  if (!business || business.archivedAt) {
    throw new AppError(404, "BUSINESS_NOT_FOUND", "Business not found");
  }

  const now = new Date();
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);

  // ── Findings compliance ───────────────────────────────────────────────────
  // Score = % of findings that have been resolved (resolvedAt set)
  const [totalFindings, resolvedFindings] = await Promise.all([
    prisma.finding.count({
      where: {
        inspection: { businessId, scheduledAt: { gte: from } },
      },
    }),
    prisma.finding.count({
      where: {
        inspection: { businessId, scheduledAt: { gte: from } },
        resolvedAt: { not: null },
      },
    }),
  ]);

  const findingsScore =
    totalFindings === 0 ? 100 : (resolvedFindings / totalFindings) * 100;

  // ── Inspection attendance ─────────────────────────────────────────────────
  // Score = % of inspections that reached COMPLETED status (not CANCELED)
  const [totalInspections, completedInspections] = await Promise.all([
    prisma.inspection.count({
      where: {
        businessId,
        scheduledAt: { gte: from },
        status: { not: "SCHEDULED" },
      },
    }),
    prisma.inspection.count({
      where: {
        businessId,
        scheduledAt: { gte: from },
        status: "COMPLETED",
      },
    }),
  ]);

  const attendanceScore =
    totalInspections === 0
      ? 100
      : (completedInspections / totalInspections) * 100;

  // ── Checklist compliance ──────────────────────────────────────────────────
  // Score = % of checklist results that are PASS (excluding NOT_APPLICABLE)
  const [totalChecklist, passedChecklist] = await Promise.all([
    prisma.inspectionChecklistResult.count({
      where: {
        inspection: { businessId, scheduledAt: { gte: from } },
        status: { not: "NOT_APPLICABLE" },
      },
    }),
    prisma.inspectionChecklistResult.count({
      where: {
        inspection: { businessId, scheduledAt: { gte: from } },
        status: "PASS",
      },
    }),
  ]);

  const checklistScore =
    totalChecklist === 0 ? 100 : (passedChecklist / totalChecklist) * 100;

  // ── Payment compliance ────────────────────────────────────────────────────
  // Score = % of PAID payments that were paid before the permit expiration date
  const payments = await prisma.paymentRecord.findMany({
    select: {
      paidAt: true,
      permitRecord: { select: { expirationDate: true } },
    },
    where: {
      permitRecord: { businessId },
      status: "PAID",
      paidAt: { gte: from },
    },
  });

  const paidOnTime = payments.filter(
    (p) => p.paidAt && p.paidAt <= p.permitRecord.expirationDate,
  ).length;

  const paymentScore =
    payments.length === 0 ? 100 : (paidOnTime / payments.length) * 100;

  // ── Weighted total ────────────────────────────────────────────────────────
  const score = Math.round(
    WEIGHT_FINDINGS * findingsScore +
      WEIGHT_ATTENDANCE * attendanceScore +
      WEIGHT_CHECKLIST * checklistScore +
      WEIGHT_PAYMENT * paymentScore,
  );

  return {
    businessId,
    businessName: business.businessName,
    computedAt: now.toISOString(),
    grade: toGrade(score),
    period: { from: from.toISOString(), to: now.toISOString() },
    score,
    breakdown: {
      checklistCompliance: {
        passed: passedChecklist,
        score: Math.round(checklistScore),
        total: totalChecklist,
      },
      findings: {
        resolved: resolvedFindings,
        score: Math.round(findingsScore),
        total: totalFindings,
      },
      inspectionAttendance: {
        attended: completedInspections,
        score: Math.round(attendanceScore),
        total: totalInspections,
      },
      paymentCompliance: {
        paidOnTime,
        score: Math.round(paymentScore),
        total: payments.length,
      },
    },
  };
}
