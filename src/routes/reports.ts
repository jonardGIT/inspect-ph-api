import { Router } from "express";
import { query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  exportInspectionsCsv,
  getPaymentReconciliation,
  getTreasurerReport,
} from "../services/reports.js";
import { getInspectionTwinSimulation } from "../services/inspection-twin.js";
import { getKpiReport } from "../services/kpi-report.js";
import { getInspectorWellnessReport } from "../services/inspector-wellness.js";
import {
  listAnomalyFlags,
  resolveAnomalyFlag,
} from "../services/payment-anomaly.js";
import { parsePaginationQuery } from "../lib/request.js";
import { param } from "express-validator";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

router.get(
  "/inspections/export",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a UUID"),
    query("status").optional().isString(),
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be an ISO 8601 date"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be an ISO 8601 date"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const csv = await exportInspectionsCsv({
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      status:
        typeof request.query.status === "string"
          ? request.query.status
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
    });

    const filename = `inspections-export-${new Date().toISOString().slice(0, 10)}.csv`;
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    response.send(csv);
  }),
);

// GET /reports/payments/reconciliation — admin / lgu_admin only
router.get(
  "/payments/reconciliation",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be ISO 8601"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be ISO 8601"),
    query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await getPaymentReconciliation({
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
    });

    response.json({ data: result });
  }),
);

// GET /reports/treasurer — admin / lgu_admin: daily fee-collection, aging receivables
router.get(
  "/treasurer",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be ISO 8601"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be ISO 8601"),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a UUID"),
    query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await getTreasurerReport({
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
    });

    response.json({ data: result });
  }),
);

router.get(
  "/kpi",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be an ISO8601 date"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be an ISO8601 date"),
    query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await getKpiReport({
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      jurisdictionScope: request.jurisdictionScope,
    });
    response.json({ data: result });
  }),
);

router.get(
  "/inspection-twin",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be an ISO8601 date"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be an ISO8601 date"),
    query("moduleCode").optional().isString(),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a UUID"),
    query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
    query("minChecklistPassRatePct")
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage("minChecklistPassRatePct must be between 0 and 100"),
    query("maxFailedChecklistItems")
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage("maxFailedChecklistItems must be between 0 and 100"),
    query("failOnHighSeverity")
      .optional()
      .isBoolean()
      .withMessage("failOnHighSeverity must be boolean"),
    query("failOnCriticalSeverity")
      .optional()
      .isBoolean()
      .withMessage("failOnCriticalSeverity must be boolean"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await getInspectionTwinSimulation({
      failOnCriticalSeverity:
        typeof request.query.failOnCriticalSeverity === "string"
          ? request.query.failOnCriticalSeverity === "true"
          : true,
      failOnHighSeverity:
        typeof request.query.failOnHighSeverity === "string"
          ? request.query.failOnHighSeverity === "true"
          : false,
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      jurisdictionScope: request.jurisdictionScope,
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      maxFailedChecklistItems:
        typeof request.query.maxFailedChecklistItems === "string"
          ? Number(request.query.maxFailedChecklistItems)
          : 2,
      minChecklistPassRatePct:
        typeof request.query.minChecklistPassRatePct === "string"
          ? Number(request.query.minChecklistPassRatePct)
          : 85,
      moduleCode:
        typeof request.query.moduleCode === "string"
          ? request.query.moduleCode
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
    });

    response.json({ data: result });
  }),
);

router.get(
  "/wellness",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be ISO8601"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be ISO8601"),
    query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await getInspectorWellnessReport({
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      jurisdictionScope: request.jurisdictionScope,
    });
    response.json({ data: result });
  }),
);

router.get(
  "/payment-anomalies",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("includeResolved")
      .optional()
      .isBoolean()
      .withMessage("includeResolved must be boolean"),
    query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const { page, limit } = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listAnomalyFlags({
      includeResolved: request.query.includeResolved === "true",
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      page,
      limit,
    });
    const { createListMeta } = await import("../lib/request.js");
    response.json({
      data: result.items,
      meta: createListMeta(result.total, page, limit),
    });
  }),
);

router.patch(
  "/payment-anomalies/:id/resolve",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) return;
    const flag = await resolveAnomalyFlag(
      String(request.params["id"]),
      request.auth.sub,
    );
    response.json({ data: flag });
  }),
);

export default router;
