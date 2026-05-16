import type {
  DataSubjectRequestStatus,
  DataSubjectRequestType,
} from "@prisma/client";
import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  createDataSubjectRequest,
  getDataSubjectRequest,
  listDataSubjectRequests,
  updateDataSubjectRequest,
} from "../services/data-subject-requests.js";

const ADMIN_ROLES = ["admin", "lgu_admin", "office_supervisor"] as const;

const router = Router();

const publicSubmitRateLimiter = createRateLimitMiddleware({
  keyPrefix: "privacy-submit",
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

const VALID_TYPES: DataSubjectRequestType[] = [
  "ACCESS",
  "CORRECTION",
  "ERASURE",
];
const VALID_STATUSES: DataSubjectRequestStatus[] = [
  "PENDING",
  "IN_REVIEW",
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
];

router.post(
  "/",
  publicSubmitRateLimiter,
  body("type")
    .isIn(VALID_TYPES)
    .withMessage("type must be ACCESS, CORRECTION, or ERASURE"),
  body("email").isEmail().normalizeEmail().withMessage("valid email required"),
  body("description")
    .isString()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("description must be 10-2000 characters"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    let requestedByUserId: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { verifyAccessToken } = await import("../lib/jwt.js");
        const payload = verifyAccessToken(authHeader.slice(7));
        requestedByUserId = payload.sub;
      } catch {
        // not authenticated — continue anonymously
      }
    }

    const record = await createDataSubjectRequest({
      description: request.body.description as string,
      email: request.body.email as string,
      requestedByUserId,
      type: request.body.type as DataSubjectRequestType,
    });

    return response.status(201).json({ data: record });
  }),
);

router.get(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  query("status").optional().isIn(VALID_STATUSES),
  query("type").optional().isIn(VALID_TYPES),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const { limit, page, skip } = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );

    const { records, total } = await listDataSubjectRequests({
      limit,
      offset: skip,
      status:
        typeof request.query.status === "string"
          ? (request.query.status as DataSubjectRequestStatus)
          : undefined,
      type:
        typeof request.query.type === "string"
          ? (request.query.type as DataSubjectRequestType)
          : undefined,
    });

    return response.json({
      data: records,
      meta: createListMeta(total, page, limit),
    });
  }),
);

router.get(
  "/:id",
  authenticate,
  authorize(...ADMIN_ROLES),
  param("id").isUUID(),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const record = await getDataSubjectRequest(String(request.params.id));
    return response.json({ data: record });
  }),
);

router.patch(
  "/:id",
  authenticate,
  authorize(...ADMIN_ROLES),
  param("id").isUUID(),
  body("status").isIn(VALID_STATUSES).withMessage("invalid status"),
  body("response").optional().isString().trim().isLength({ max: 5000 }),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const record = await updateDataSubjectRequest(String(request.params.id), {
      response:
        typeof request.body.response === "string"
          ? request.body.response
          : undefined,
      status: request.body.status as DataSubjectRequestStatus,
    });

    return response.json({ data: record });
  }),
);

export default router;
