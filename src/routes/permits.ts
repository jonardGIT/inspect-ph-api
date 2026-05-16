import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  archivePermit,
  createPermit,
  getPermit,
  getPublicPermitFindingsByNumber,
  getPublicPermitByNumber,
  listOwnPermits,
  listPermits,
  requestPermitRenewal,
  updatePermit,
} from "../services/permits.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();
const publicPermitLookupRateLimiter = createRateLimitMiddleware({
  keyPrefix: "public-permit-lookup",
  limit: 20,
  windowMs: 60_000,
});

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
  "/public/:permitNumber/findings",
  publicPermitLookupRateLimiter,
  [
    param("permitNumber")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("permitNumber is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const permitNumber = Array.isArray(request.params.permitNumber)
      ? request.params.permitNumber[0]
      : request.params.permitNumber;

    const findingsLookup = await getPublicPermitFindingsByNumber({
      permitNumber: permitNumber.trim(),
    });

    response.json({ data: findingsLookup });
  }),
);

router.get(
  "/public/:permitNumber",
  publicPermitLookupRateLimiter,
  [
    param("permitNumber")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("permitNumber is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const permitNumber = Array.isArray(request.params.permitNumber)
      ? request.params.permitNumber[0]
      : request.params.permitNumber;

    const permit = await getPublicPermitByNumber({
      permitNumber: permitNumber.trim(),
    });

    response.json({ data: permit });
  }),
);

router.get(
  "/mine",
  authenticate,
  authorize("business_owner"),
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("status").optional().isString().trim(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = parsePaginationQuery(request.query);
    const rawStatus =
      typeof request.query.status === "string"
        ? parsePermitStatus(request.query.status)
        : undefined;

    const result = await listOwnPermits({
      limit,
      page,
      skip,
      status: rawStatus,
      userId: request.auth!.sub,
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

router.get(
  "/:id",
  authenticate,
  requireJurisdiction(),
  param("id").isUUID().withMessage("id must be a valid UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const permit = await getPermit(request.params["id"] as string);
    response.json({ data: permit });
  }),
);

router.patch(
  "/:id",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("lineOfBusiness").optional().isString().trim().notEmpty(),
    body("permitNumber").optional().isString().trim().notEmpty(),
    body("applicationDate").optional().isISO8601(),
    body("expirationDate").optional().isISO8601(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const permit = await updatePermit(request.params["id"] as string, {
      applicationDate:
        typeof request.body.applicationDate === "string"
          ? request.body.applicationDate
          : undefined,
      expirationDate:
        typeof request.body.expirationDate === "string"
          ? request.body.expirationDate
          : undefined,
      lineOfBusiness:
        typeof request.body.lineOfBusiness === "string"
          ? request.body.lineOfBusiness
          : undefined,
      permitNumber:
        typeof request.body.permitNumber === "string"
          ? request.body.permitNumber
          : undefined,
    });
    response.json({ data: permit });
  }),
);

router.patch(
  "/:id/archive",
  authenticate,
  authorize(...ADMIN_ROLES),
  param("id").isUUID().withMessage("id must be a valid UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const permit = await archivePermit(request.params["id"] as string);
    response.json({ data: permit });
  }),
);

// POST /permits/renewal-application — business_owner self-service renewal
router.post(
  "/renewal-application",
  authenticate,
  authorize("business_owner"),
  body("businessId").isUUID().withMessage("businessId must be a UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const permit = await requestPermitRenewal({
      actorUserId: request.auth!.sub,
      businessId: request.body.businessId as string,
    });
    response.status(201).json({ data: permit });
  }),
);

export default router;
