import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import { ADMIN_ROLES } from "../types/auth.js";
import {
  createRecognitionRequest,
  getRecognitionRequest,
  listPendingConsentRequests,
  listRecognitionRequests,
  resolveRecognitionRequest,
  respondToConsent,
  verifyRecognitionSignature,
} from "../services/mutual-recognition.js";
import type { CrossLguRecognitionStatus } from "@prisma/client";

const router = Router();

// ---------------------------------------------------------------------------
// GET /mutual-recognition/requests
// LGU admin lists recognition requests for their LGU (requesting or issuing)
// ---------------------------------------------------------------------------

router.get(
  "/requests",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  [
    query("status").optional().isString(),
    query("role")
      .optional()
      .isIn(["requesting", "issuing", "both"])
      .withMessage("role must be requesting, issuing, or both"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const lguId = request.jurisdictionScope?.lguIds[0];

    if (!lguId) {
      response
        .status(403)
        .json({
          error: { code: "NO_LGU_SCOPE", message: "No LGU scope resolved" },
        });
      return;
    }

    const role =
      (request.query.role as "requesting" | "issuing" | "both" | undefined) ??
      "both";
    const status = request.query.status as
      | CrossLguRecognitionStatus
      | undefined;

    const result = await listRecognitionRequests({
      lguId,
      query: request.query as Record<string, unknown>,
      role,
      status,
    });

    response.json({
      data: result.items,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /mutual-recognition/requests
// LGU admin creates a new recognition request
// ---------------------------------------------------------------------------

router.post(
  "/requests",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  [body("certificateNumber").notEmpty().isString(), validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const lguId = request.jurisdictionScope?.lguIds[0];

    if (!lguId) {
      response
        .status(403)
        .json({
          error: { code: "NO_LGU_SCOPE", message: "No LGU scope resolved" },
        });
      return;
    }

    const result = await createRecognitionRequest({
      certificateNumber: String(request.body.certificateNumber),
      requestedByUserId: request.auth.sub,
      requestingLguId: lguId,
    });

    response.status(201).json({ data: result });
  }),
);

// ---------------------------------------------------------------------------
// GET /mutual-recognition/requests/:id
// ---------------------------------------------------------------------------

router.get(
  "/requests/:id",
  authenticate,
  authorize(...ADMIN_ROLES, "business_owner"),
  [param("id").isUUID(), validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const result = await getRecognitionRequest(String(request.params["id"]));
    response.json({ data: result });
  }),
);

// ---------------------------------------------------------------------------
// POST /mutual-recognition/requests/:id/consent
// Business owner grants or denies consent
// ---------------------------------------------------------------------------

router.post(
  "/requests/:id/consent",
  authenticate,
  authorize("business_owner"),
  [
    param("id").isUUID(),
    body("decision")
      .isIn(["grant", "deny"])
      .withMessage("decision must be 'grant' or 'deny'"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await respondToConsent(
      String(request.params["id"]),
      request.auth.sub,
      request.body.decision as "grant" | "deny",
    );

    response.json({ data: result });
  }),
);

// ---------------------------------------------------------------------------
// POST /mutual-recognition/requests/:id/resolve
// Issuing LGU admin approves or rejects a consent-granted request
// ---------------------------------------------------------------------------

router.post(
  "/requests/:id/resolve",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID(),
    body("decision")
      .isIn(["approve", "reject"])
      .withMessage("decision must be 'approve' or 'reject'"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await resolveRecognitionRequest(
      String(request.params["id"]),
      request.auth.sub,
      request.body.decision as "approve" | "reject",
    );

    response.json({ data: result });
  }),
);

// ---------------------------------------------------------------------------
// GET /mutual-recognition/pending-consent
// Business owner: list their pending consent requests
// ---------------------------------------------------------------------------

router.get(
  "/pending-consent",
  authenticate,
  authorize("business_owner"),
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const results = await listPendingConsentRequests(request.auth.sub);
    response.json({ data: results });
  }),
);

// ---------------------------------------------------------------------------
// POST /mutual-recognition/verify
// Unauthenticated payload verification endpoint
// ---------------------------------------------------------------------------

router.post(
  "/verify",
  [
    body("signedPayload").notEmpty().isString(),
    body("signature").notEmpty().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const { signedPayload, signature } = request.body as {
      signedPayload: string;
      signature: string;
    };

    const valid = verifyRecognitionSignature(signedPayload, signature);

    if (!valid) {
      throw new AppError(
        400,
        "INVALID_SIGNATURE",
        "Signature verification failed",
      );
    }

    // Return the parsed payload if valid
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(signedPayload) as unknown;
    } catch {
      throw new AppError(400, "INVALID_PAYLOAD", "Payload is not valid JSON");
    }

    response.json({ data: { valid: true, payload: parsed } });
  }),
);

export { router as mutualRecognitionRouter };
