import { Router } from "express";
import { body, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createModule, listModules } from "../services/modules.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

router.get(
  "/",
  authenticate,
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    query("search").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listModules({
      isActive:
        typeof request.query.isActive === "string"
          ? request.query.isActive === "true"
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
    body("code").isString().trim().notEmpty().withMessage("code is required"),
    body("name").isString().trim().notEmpty().withMessage("name is required"),
    body("description").optional().isString(),
    body("isActive").optional().isBoolean(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const module = await createModule({
      code: String(request.body.code),
      description:
        typeof request.body.description === "string"
          ? request.body.description
          : undefined,
      isActive:
        typeof request.body.isActive === "boolean"
          ? request.body.isActive
          : undefined,
      name: String(request.body.name),
    });

    response.status(201).json({ data: module });
  }),
);

export default router;
