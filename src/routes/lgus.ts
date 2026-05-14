import { Router } from "express";
import { body, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import { createLgu, listLgus } from "../services/lgus.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

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
    query("search").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listLgus({
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
      limit: pagination.limit,
      page: pagination.page,
      search:
        typeof request.query.search === "string"
          ? request.query.search
          : undefined,
      skip: pagination.skip,
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
    body("code").isString().trim().notEmpty().withMessage("code is required"),
    body("name").isString().trim().notEmpty().withMessage("name is required"),
    body("region").optional().isString(),
    body("province").optional().isString(),
    body("city").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const lgu = await createLgu({
      city:
        typeof request.body.city === "string" ? request.body.city : undefined,
      code: String(request.body.code),
      name: String(request.body.name),
      province:
        typeof request.body.province === "string"
          ? request.body.province
          : undefined,
      region:
        typeof request.body.region === "string"
          ? request.body.region
          : undefined,
    });

    response.status(201).json({ data: lgu });
  }),
);

export default router;
