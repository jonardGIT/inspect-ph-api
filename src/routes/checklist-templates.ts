import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createChecklistTemplate,
  getChecklistTemplate,
  listChecklistTemplates,
  updateChecklistTemplateActive,
} from "../services/checklist-templates.js";
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
      .isInt({ min: 1, max: 200 })
      .withMessage("limit must be between 1 and 200"),
    query("module").optional().isString().trim(),
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

    const result = await listChecklistTemplates({
      isActive:
        typeof request.query.isActive === "string"
          ? request.query.isActive === "true"
          : undefined,
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

router.get(
  "/:id",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const template = await getChecklistTemplate(String(request.params.id));

    response.json({ data: template });
  }),
);

router.post(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    body("code")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("code is required")
      .isLength({ max: 80 })
      .withMessage("code must be at most 80 characters"),
    body("module")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("module is required")
      .isLength({ max: 40 })
      .withMessage("module must be at most 40 characters"),
    body("title")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("title is required")
      .isLength({ max: 255 })
      .withMessage("title must be at most 255 characters"),
    body("description")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("description must be at most 1000 characters"),
    body("sortOrder")
      .optional()
      .isInt({ min: 0 })
      .withMessage("sortOrder must be a non-negative integer"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be boolean"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const template = await createChecklistTemplate({
      code: request.body.code as string,
      description: request.body.description as string | undefined,
      isActive:
        typeof request.body.isActive === "boolean"
          ? request.body.isActive
          : undefined,
      module: request.body.module as string,
      sortOrder:
        typeof request.body.sortOrder === "number"
          ? request.body.sortOrder
          : undefined,
      title: request.body.title as string,
    });

    response.status(201).json({ data: template });
  }),
);

router.patch(
  "/:id/active",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    body("isActive")
      .isBoolean()
      .withMessage("isActive is required and must be boolean"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const template = await updateChecklistTemplateActive(
      String(request.params.id),
      request.body.isActive as boolean,
    );

    response.json({ data: template });
  }),
);

export default router;
