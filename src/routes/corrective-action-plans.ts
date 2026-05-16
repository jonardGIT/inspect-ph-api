import type { CapStatus } from "@prisma/client";
import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import { prisma } from "../lib/prisma.js";
import {
  createCap,
  listCaps,
  listMineCaps,
  updateCapStatus,
} from "../services/corrective-action-plans.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

const CAP_STATUS_VALUES: CapStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "ESCALATED",
];

// POST /findings/:findingId/cap — create a CAP for a finding (admin roles only)
router.post(
  "/findings/:findingId/cap",
  authenticate,
  authorize(...ADMIN_ROLES),
  param("findingId").isUUID().withMessage("findingId must be a UUID"),
  body("description")
    .isString()
    .notEmpty()
    .withMessage("description is required"),
  body("deadlineAt")
    .optional()
    .isISO8601()
    .withMessage("deadlineAt must be an ISO 8601 date"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const cap = await createCap({
      actorRole: request.auth!.role,
      actorUserId: request.auth!.sub,
      findingId: request.params["findingId"] as string,
      description: request.body.description as string,
      deadlineAt: request.body.deadlineAt as string | undefined,
    });
    response.status(201).json({ data: cap });
  }),
);

// GET /caps — list all CAPs (admin + inspector, jurisdiction scoped)
router.get(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES, "inspector"),
  requireJurisdiction(),
  query("status")
    .optional()
    .isIn(CAP_STATUS_VALUES)
    .withMessage(`status must be one of: ${CAP_STATUS_VALUES.join(", ")}`),
  query("businessId")
    .optional()
    .isUUID()
    .withMessage("businessId must be a UUID"),
  query("inspectionId")
    .optional()
    .isUUID()
    .withMessage("inspectionId must be a UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const { rows, total } = await listCaps({
      actorUserId: request.auth!.sub,
      jurisdictionScope: request.jurisdictionScope!,
      ...pagination,
      status: request.query["status"] as CapStatus | undefined,
      businessId: request.query["businessId"] as string | undefined,
      inspectionId: request.query["inspectionId"] as string | undefined,
    });

    response.json({
      data: rows,
      meta: createListMeta(total, pagination.page, pagination.limit),
    });
  }),
);

// GET /caps/mine — business_owner's own CAPs
router.get(
  "/mine",
  authenticate,
  authorize("business_owner"),
  query("status")
    .optional()
    .isIn(CAP_STATUS_VALUES)
    .withMessage(`status must be one of: ${CAP_STATUS_VALUES.join(", ")}`),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const actorUserId = request.auth!.sub;

    // Look up business linked to this user
    const user = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { businessId: true },
    });

    if (!user?.businessId) {
      response.json({ data: [], meta: { total: 0, page: 1, limit: 20 } });
      return;
    }

    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const { rows, total } = await listMineCaps({
      actorUserId,
      businessId: user.businessId,
      ...pagination,
      status: request.query["status"] as CapStatus | undefined,
    });

    response.json({
      data: rows,
      meta: createListMeta(total, pagination.page, pagination.limit),
    });
  }),
);

// PATCH /caps/:id/status — update CAP status
router.patch(
  "/:id/status",
  authenticate,
  authorize(...ADMIN_ROLES, "inspector", "business_owner"),
  param("id").isUUID().withMessage("id must be a UUID"),
  body("status")
    .isIn(CAP_STATUS_VALUES)
    .withMessage(`status must be one of: ${CAP_STATUS_VALUES.join(", ")}`),
  body("responseNote").optional().isString(),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const cap = await updateCapStatus({
      actorRole: request.auth!.role,
      actorUserId: request.auth!.sub,
      id: request.params["id"] as string,
      status: request.body.status as CapStatus,
      responseNote: request.body.responseNote as string | undefined,
    });
    response.json({ data: cap });
  }),
);

export default router;
