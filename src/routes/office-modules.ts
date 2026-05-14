import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createOfficeModule,
  deleteOfficeModule,
  listOfficeModules,
} from "../services/office-modules.js";
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
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a valid UUID"),
    query("moduleId")
      .optional()
      .isUUID()
      .withMessage("moduleId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listOfficeModules({
      limit: pagination.limit,
      moduleId:
        typeof request.query.moduleId === "string"
          ? request.query.moduleId
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      page: pagination.page,
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
    body("officeId").isUUID().withMessage("officeId must be a valid UUID"),
    body("moduleId").isUUID().withMessage("moduleId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const assignment = await createOfficeModule({
      moduleId: String(request.body.moduleId),
      officeId: String(request.body.officeId),
    });

    response.status(201).json({ data: assignment });
  }),
);

router.delete(
  "/:id",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const assignmentId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;

    await deleteOfficeModule({ assignmentId });

    response.status(204).send();
  }),
);

export default router;
