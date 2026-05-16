import { Router } from "express";
import { body, param } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createFindingDispute,
  getDisputeByFinding,
  resolveDispute,
} from "../services/finding-disputes.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

// POST /findings/:findingId/dispute — business_owner only; submit a dispute
router.post(
  "/:findingId/dispute",
  authenticate,
  authorize("business_owner"),
  [
    param("findingId").isUUID().withMessage("findingId must be a valid UUID"),
    body("reason")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 2000 })
      .withMessage("reason is required (max 2000 characters)"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const dispute = await createFindingDispute({
      actorUserId: request.auth!.sub,
      findingId: request.params["findingId"] as string,
      reason: request.body.reason as string,
    });

    response.status(201).json({ data: dispute });
  }),
);

// GET /findings/:findingId/dispute — any authenticated role
router.get(
  "/:findingId/dispute",
  authenticate,
  [
    param("findingId").isUUID().withMessage("findingId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const dispute = await getDisputeByFinding(
      request.params["findingId"] as string,
    );

    response.json({ data: dispute });
  }),
);

// PATCH /findings/:findingId/dispute — admin roles only; set status + resolution
router.patch(
  "/:findingId/dispute",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("findingId").isUUID().withMessage("findingId must be a valid UUID"),
    body("status")
      .isIn(["REVIEWING", "UPHELD", "OVERTURNED"])
      .withMessage("status must be REVIEWING, UPHELD, or OVERTURNED"),
    body("resolution")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("resolution max 2000 characters"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const dispute = await resolveDispute({
      actorRole: request.auth!.role,
      actorUserId: request.auth!.sub,
      findingId: request.params["findingId"] as string,
      resolution:
        typeof request.body.resolution === "string"
          ? request.body.resolution
          : undefined,
      status: request.body.status as "REVIEWING" | "UPHELD" | "OVERTURNED",
    });

    response.json({ data: dispute });
  }),
);

export default router;
