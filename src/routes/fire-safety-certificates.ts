import type { FireSafetyCertificateStatus } from "@prisma/client";
import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import { requireModule } from "../middleware/module-gate.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  createFireSafetyCertificate,
  getCertificateHtml,
  getFireSafetyCertificateByInspection,
  getPublicCertificateVerification,
  getPublicCertificateVerificationByToken,
  getPublicFireSafetyCertificateByNumber,
  listFireSafetyCertificates,
  listOwnCertificates,
} from "../services/fire-safety-certificates.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();
const publicCertificateLookupRateLimiter = createRateLimitMiddleware({
  keyPrefix: "public-fire-safety-certificate",
  limit: 60,
  windowMs: 60_000,
});

function parseCertificateStatus(
  value: unknown,
): FireSafetyCertificateStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validStatuses = ["DRAFT", "ISSUED", "REVOKED", "EXPIRED"] as const;

  if (!validStatuses.includes(normalized as (typeof validStatuses)[number])) {
    return undefined;
  }

  return normalized as FireSafetyCertificateStatus;
}

router.get(
  "/public/:certificateNumber",
  publicCertificateLookupRateLimiter,
  [
    param("certificateNumber")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("certificateNumber is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const certificateNumber = Array.isArray(request.params.certificateNumber)
      ? request.params.certificateNumber[0]
      : request.params.certificateNumber;

    const certificate = await getPublicFireSafetyCertificateByNumber({
      certificateNumber,
    });

    response.json({ data: certificate });
  }),
);

router.get(
  "/mine",
  authenticate,
  authorize("business_owner"),
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = parsePaginationQuery(request.query);

    const result = await listOwnCertificates({
      limit,
      page,
      skip,
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
  requireModule("FIRE"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a valid UUID"),
    query("status")
      .optional()
      .isIn(["draft", "issued", "revoked", "expired"])
      .withMessage("status must be a valid fire safety certificate status"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listFireSafetyCertificates({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
      limit: pagination.limit,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      page: pagination.page,
      skip: pagination.skip,
      status: parseCertificateStatus(request.query.status),
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
  "/inspection/:inspectionId",
  authenticate,
  requireJurisdiction(),
  requireModule("FIRE"),
  [
    param("inspectionId")
      .isUUID()
      .withMessage("inspectionId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const inspectionId = Array.isArray(request.params.inspectionId)
      ? request.params.inspectionId[0]
      : request.params.inspectionId;

    const certificate = await getFireSafetyCertificateByInspection({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      inspectionId,
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
    });

    response.json({ data: certificate });
  }),
);

router.post(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  requireModule("FIRE"),
  [
    body("inspectionId")
      .isUUID()
      .withMessage("inspectionId must be a valid UUID"),
    body("issuedAt")
      .isISO8601()
      .withMessage("issuedAt must be a valid ISO date"),
    body("expiresAt")
      .isISO8601()
      .withMessage("expiresAt must be a valid ISO date"),
    body("remarks").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const certificate = await createFireSafetyCertificate({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      expiresAt: String(request.body.expiresAt),
      inspectionId: String(request.body.inspectionId),
      issuedAt: String(request.body.issuedAt),
      remarks:
        typeof request.body.remarks === "string"
          ? request.body.remarks
          : undefined,
    });

    response.status(201).json({ data: certificate });
  }),
);

// GET /public/:certificateNumber/verify — public QR-based verification
router.get(
  "/public/:certificateNumber/verify",
  publicCertificateLookupRateLimiter,
  param("certificateNumber").isString().notEmpty(),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const result = await getPublicCertificateVerification(
      request.params["certificateNumber"] as string,
    );
    response.json({ data: result });
  }),
);

// GET /public/verify/:token — public signed-token verification
router.get(
  "/public/verify/:token",
  publicCertificateLookupRateLimiter,
  param("token").isString().notEmpty(),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const result = await getPublicCertificateVerificationByToken(
      request.params["token"] as string,
    );
    response.json({ data: result });
  }),
);

// GET /:id/print — printable HTML certificate with QR code
router.get(
  "/:id/print",
  authenticate,
  authorize(...ADMIN_ROLES, "inspector", "business_owner"),
  param("id").isUUID().withMessage("id must be a UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const html = await getCertificateHtml(request.params["id"] as string);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.send(html);
  }),
);

export default router;
