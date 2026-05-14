import { Router } from "express";
import { body, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import { createPermit, listPermits } from "../services/permits.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

function parsePermitStatus(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validStatuses = [
    "DRAFT",
    "PENDING_INSPECTION",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
  ] as const;

  if (!validStatuses.includes(normalized as (typeof validStatuses)[number])) {
    throw new AppError(400, "VALIDATION_ERROR", "status is invalid");
  }

  return normalized as (typeof validStatuses)[number];
}

router.get(
  "/",
  authenticate,
  requireJurisdiction(),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("businessId")
      .optional()
      .isUUID()
      .withMessage("businessId must be a valid UUID"),
    query("status").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listPermits({
      businessId:
        typeof request.query.businessId === "string"
          ? request.query.businessId
          : undefined,
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
      limit: pagination.limit,
      page: pagination.page,
      skip: pagination.skip,
      status: parsePermitStatus(request.query.status),
    });

    response.json({
      data: result.data,
      meta: createListMeta(
        result.meta.total,
        result.meta.page,
        result.meta.limit,
      ),
    });
  }),
);

router.post(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    body("businessId").isUUID().withMessage("businessId must be a valid UUID"),
    body("permitNumber")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("permitNumber is required"),
    body("applicationDate")
      .isISO8601()
      .withMessage("applicationDate must be a valid ISO 8601 date"),
    body("expirationDate")
      .isISO8601()
      .withMessage("expirationDate must be a valid ISO 8601 date"),
    body("lineOfBusiness")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("lineOfBusiness is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const permit = await createPermit({
      applicationDate: String(request.body.applicationDate),
      businessId: String(request.body.businessId),
      createdById: request.auth.sub,
      expirationDate: String(request.body.expirationDate),
      lineOfBusiness: String(request.body.lineOfBusiness),
      permitNumber: String(request.body.permitNumber),
    });

    response.status(201).json({ data: permit });
  }),
);

export default router;
