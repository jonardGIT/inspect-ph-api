import { Router } from "express";
import { body, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { ADMIN_ROLES } from "../types/auth.js";
import type { NationalVerificationKind } from "@prisma/client";
import {
  getDisasterAlerts,
  listVerificationHistory,
  lookupBusinessName,
  verifyBirTin,
  verifyPhilSysPcn,
} from "../services/national-integrations.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /national/verify-pcn — PhilSys PCN verification (admin)
// ---------------------------------------------------------------------------

router.post(
  "/verify-pcn",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    body("pcn")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("pcn is required"),
    body("assertedName")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("assertedName is required"),
    body("businessId").optional().isUUID(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }

    const result = await verifyPhilSysPcn({
      assertedName: String(request.body["assertedName"]),
      businessId: request.body["businessId"] as string | undefined,
      pcn: String(request.body["pcn"]),
      requestedByUserId: request.auth.sub,
    });

    response.json({ data: result });
  }),
);

// ---------------------------------------------------------------------------
// POST /national/verify-tin — BIR TIN verification (admin)
// ---------------------------------------------------------------------------

router.post(
  "/verify-tin",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    body("tin")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("tin is required"),
    body("assertedBusinessName")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("assertedBusinessName is required"),
    body("businessId").optional().isUUID(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }

    const result = await verifyBirTin({
      assertedBusinessName: String(request.body["assertedBusinessName"]),
      businessId: request.body["businessId"] as string | undefined,
      requestedByUserId: request.auth.sub,
      tin: String(request.body["tin"]),
    });

    response.json({ data: result });
  }),
);

// ---------------------------------------------------------------------------
// GET /national/business-lookup — DTI/SEC business name search (admin)
// ---------------------------------------------------------------------------

router.get(
  "/business-lookup",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("q")
      .isString()
      .trim()
      .isLength({ min: 2 })
      .withMessage("q must be at least 2 characters"),
    query("type")
      .optional()
      .isIn(["DTI", "SEC", "ALL"])
      .withMessage("type must be DTI, SEC, or ALL"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }

    const results = await lookupBusinessName({
      query: String(request.query["q"]),
      requestedByUserId: request.auth.sub,
      type: (request.query["type"] as "ALL" | "DTI" | "SEC") ?? "ALL",
    });

    response.json({ data: results });
  }),
);

// ---------------------------------------------------------------------------
// GET /national/disaster-alerts — PAGASA/PHIVOLCS/NDRRMC alerts (all authed)
// ---------------------------------------------------------------------------

router.get(
  "/disaster-alerts",
  authenticate,
  [
    query("region").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }

    const alerts = await getDisasterAlerts({
      region: request.query["region"] ? String(request.query["region"]) : undefined,
      requestedByUserId: request.auth.sub,
    });

    response.json({ data: alerts });
  }),
);

// ---------------------------------------------------------------------------
// GET /national/verifications — verification history (admin)
// ---------------------------------------------------------------------------

router.get(
  "/verifications",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("businessId").optional().isUUID(),
    query("kind")
      .optional()
      .isIn(["PCN", "TIN", "DTI_NAME", "SEC_NAME", "LRA_PARCEL", "DISASTER_ALERT"])
      .withMessage("kind must be a valid NationalVerificationKind"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const { limit, page, skip } = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );

    const result = await listVerificationHistory({
      businessId: request.query["businessId"]
        ? String(request.query["businessId"])
        : undefined,
      kind: request.query["kind"] as NationalVerificationKind | undefined,
      limit,
      page,
      skip,
    });

    response.json({
      data: result.items,
      meta: createListMeta(result.total, page, limit),
    });
  }),
);

export { router as nationalIntegrationsRouter };
