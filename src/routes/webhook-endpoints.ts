import { Router } from "express";
import { body, param } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import { ADMIN_ROLES } from "../types/auth.js";
import {
  deleteWebhookEndpoint,
  listWebhookEndpoints,
  registerWebhookEndpoint,
  type OutboundWebhookEvent,
} from "../services/webhook-delivery.js";

const ALLOWED_EVENTS: OutboundWebhookEvent[] = [
  "inspection.completed",
  "finding.raised",
  "certificate.issued",
  "payment.received",
];

const router = Router();

// GET /webhook-endpoints — list endpoints for the caller's LGU
router.get(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  asyncHandler(async (request, response) => {
    const lguId = request.jurisdictionScope?.lguIds[0];
    if (!lguId) {
      response.status(403).json({
        error: { code: "NO_LGU_SCOPE", message: "No LGU scope resolved" },
      });
      return;
    }

    const endpoints = await listWebhookEndpoints(lguId);
    response.json({ data: endpoints });
  }),
);

// POST /webhook-endpoints — register a new endpoint
router.post(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  [
    body("url")
      .isURL({ protocols: ["https"] })
      .withMessage("url must be a valid HTTPS URL"),
    body("secret")
      .isString()
      .isLength({ min: 16 })
      .withMessage("secret must be at least 16 characters"),
    body("events")
      .isArray({ min: 1 })
      .withMessage("events must be a non-empty array"),
    body("events.*")
      .isIn(ALLOWED_EVENTS)
      .withMessage(`Each event must be one of: ${ALLOWED_EVENTS.join(", ")}`),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const lguId = request.jurisdictionScope?.lguIds[0];
    if (!lguId) {
      response.status(403).json({
        error: { code: "NO_LGU_SCOPE", message: "No LGU scope resolved" },
      });
      return;
    }

    if (!request.auth) {
      response
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
      return;
    }

    const endpoint = await registerWebhookEndpoint({
      lguId,
      url: request.body.url as string,
      secret: request.body.secret as string,
      events: request.body.events as OutboundWebhookEvent[],
      actorUserId: request.auth.sub,
    });

    // Return endpoint without secret
    const { secret: _secret, ...safeEndpoint } = endpoint;
    response.status(201).json({ data: safeEndpoint });
  }),
);

// DELETE /webhook-endpoints/:id
router.delete(
  "/:id",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const lguId = request.jurisdictionScope?.lguIds[0];
    if (!lguId) {
      response.status(403).json({
        error: { code: "NO_LGU_SCOPE", message: "No LGU scope resolved" },
      });
      return;
    }

    if (!request.auth) {
      response
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
      return;
    }

    await deleteWebhookEndpoint(
      String(request.params["id"]),
      lguId,
      request.auth.sub,
    );

    response.status(204).send();
  }),
);

export default router;
