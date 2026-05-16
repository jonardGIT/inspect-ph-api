import { Router } from "express";
import { query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { exportInspectionsCsv } from "../services/reports.js";
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

export default router;
