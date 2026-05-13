import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  listNotificationOutbox,
  type PublicNotificationOutboxEntry,
  updateNotificationOutboxStatus,
} from "../services/notifications-outbox.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("eventType").optional().isString(),
    query("search").optional().isString(),
    query("status").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listNotificationOutbox({
      eventType:
        typeof request.query.eventType === "string"
          ? (request.query
              .eventType as PublicNotificationOutboxEntry["eventType"])
          : undefined,
      limit: pagination.limit,
      page: pagination.page,
      search:
        typeof request.query.search === "string"
          ? request.query.search
          : undefined,
      skip: pagination.skip,
      status:
        typeof request.query.status === "string"
          ? (request.query.status as PublicNotificationOutboxEntry["status"])
          : undefined,
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

router.patch(
  "/:id/status",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("status")
      .isIn(["pending", "processed", "failed"])
      .withMessage("status must be pending, processed, or failed"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;

    try {
      const updatedEntry = await updateNotificationOutboxStatus({
        id,
        status: request.body.status as PublicNotificationOutboxEntry["status"],
      });

      response.json({ data: updatedEntry });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "NOTIFICATION_OUTBOX_NOT_FOUND"
      ) {
        throw new AppError(
          404,
          "NOTIFICATION_OUTBOX_NOT_FOUND",
          "Notification outbox entry not found",
        );
      }

      throw error;
    }
  }),
);

export default router;
