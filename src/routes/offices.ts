import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import {
  archiveOffice,
  createOffice,
  listOffices,
} from "../services/offices.js";
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
    query("lguId")
      .optional()
      .isUUID()
      .withMessage("lguId must be a valid UUID"),
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
    const result = await listOffices({
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
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
    body("lguId").isUUID().withMessage("lguId must be a valid UUID"),
    body("code").isString().trim().notEmpty().withMessage("code is required"),
    body("name").isString().trim().notEmpty().withMessage("name is required"),
    body("description").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const office = await createOffice({
      code: String(request.body.code),
      description:
        typeof request.body.description === "string"
          ? request.body.description
          : undefined,
      lguId: String(request.body.lguId),
      name: String(request.body.name),
    });

    response.status(201).json({ data: office });
  }),
);

router.patch(
  "/:id/archive",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    await archiveOffice(String(request.params.id));
    response.status(204).send();
  }),
);

export default router;
