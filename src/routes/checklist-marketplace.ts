import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import {
  forkChecklistTemplate,
  listMarketplaceTemplates,
  promoteToDefault,
  publishChecklistTemplate,
  rateChecklistTemplate,
} from "../services/checklist-marketplace.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /checklist-templates/marketplace — public listing
// ---------------------------------------------------------------------------

router.get(
  "/marketplace",
  authenticate,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("module").optional().isString().trim(),
    query("search").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );

    const result = await listMarketplaceTemplates({
      limit: pagination.limit,
      module:
        typeof request.query.module === "string"
          ? request.query.module
          : undefined,
      page: pagination.page,
      search:
        typeof request.query.search === "string"
          ? request.query.search
          : undefined,
      skip: pagination.skip,
    });

    response.json(result);
  }),
);

// ---------------------------------------------------------------------------
// POST /checklist-templates/:id/fork — fork into caller's LGU
// ---------------------------------------------------------------------------

router.post(
  "/:id/fork",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const scope = request.jurisdictionScope;
    const lguId = scope?.lguIds[0];

    if (!lguId) {
      response
        .status(403)
        .json({ error: "No LGU associated with your account" });
      return;
    }

    const template = await forkChecklistTemplate(
      String(request.params["id"]),
      lguId,
      request.auth.sub,
    );

    response.status(201).json({ data: template });
  }),
);

// ---------------------------------------------------------------------------
// POST /checklist-templates/:id/publish — publish to marketplace
// ---------------------------------------------------------------------------

router.post(
  "/:id/publish",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const template = await publishChecklistTemplate(
      String(request.params["id"]),
      request.auth.sub,
    );

    response.json({ data: template });
  }),
);

// ---------------------------------------------------------------------------
// POST /checklist-templates/:id/promote — promote to platform-default (admin only)
// ---------------------------------------------------------------------------

router.post(
  "/:id/promote",
  authenticate,
  authorize("admin"),
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const template = await promoteToDefault(
      String(request.params["id"]),
      request.auth.sub,
    );

    response.json({ data: template });
  }),
);

// ---------------------------------------------------------------------------
// POST /checklist-templates/:id/rate — rate a marketplace template (per LGU)
// ---------------------------------------------------------------------------

router.post(
  "/:id/rate",
  authenticate,
  authorize(...ADMIN_ROLES),
  requireJurisdiction(),
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("rating must be an integer from 1 to 5"),
    body("comment").optional().isString().isLength({ max: 500 }),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const scope = request.jurisdictionScope;
    const lguId = scope?.lguIds[0];

    if (!lguId) {
      response
        .status(403)
        .json({ error: "No LGU associated with your account" });
      return;
    }

    const ratingRecord = await rateChecklistTemplate({
      comment:
        typeof request.body.comment === "string"
          ? request.body.comment
          : undefined,
      lguId,
      rating: Number(request.body.rating),
      templateId: String(request.params["id"]),
    });

    response.json({ data: ratingRecord });
  }),
);

export { router as checklistMarketplaceRouter };
