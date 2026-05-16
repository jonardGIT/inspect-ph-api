import type { PaymentProvider, PaymentStatus } from "@prisma/client";
import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  createPayment,
  getPaymentReceipt,
  getPublicPaymentByReferenceNumber,
  listPayments,
  processPaymentWebhook,
} from "../services/payments.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();
const publicPaymentRateLimiter = createRateLimitMiddleware({
  keyPrefix: "public-payment",
  limit: 30,
  windowMs: 60_000,
});

function parsePaymentProvider(value: unknown): PaymentProvider | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized !== "LOCAL" && normalized !== "PAYMONGO") {
    return undefined;
  }

  return normalized as PaymentProvider;
}

function parsePaymentStatus(value: unknown): PaymentStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  if (
    normalized !== "PENDING" &&
    normalized !== "PROCESSING" &&
    normalized !== "PAID" &&
    normalized !== "FAILED" &&
    normalized !== "REFUNDED"
  ) {
    return undefined;
  }

  return normalized as PaymentStatus;
}

router.get(
  "/public/:referenceNumber",
  publicPaymentRateLimiter,
  [
    param("referenceNumber")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("referenceNumber is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const referenceNumber = Array.isArray(request.params.referenceNumber)
      ? request.params.referenceNumber[0]
      : request.params.referenceNumber;
    const payment = await getPublicPaymentByReferenceNumber({
      referenceNumber,
    });

    response.json({ data: payment });
  }),
);

router.post(
  "/webhooks",
  publicPaymentRateLimiter,
  [
    body("providerPaymentId").optional().isString(),
    body("status").optional().isString(),
    body("failureReason").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const rawBody = (request as typeof request & { rawBody?: string }).rawBody;
    const payment = await processPaymentWebhook({
      body: rawBody ?? request.body,
      headers: request.headers,
    });

    response.json({ data: payment });
  }),
);

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
    query("permitId").optional().isUUID(),
    query("provider").optional().isIn(["local", "paymongo"]),
    query("status")
      .optional()
      .isIn(["pending", "processing", "paid", "failed", "refunded"]),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listPayments({
      limit: pagination.limit,
      page: pagination.page,
      permitId:
        typeof request.query.permitId === "string"
          ? request.query.permitId
          : undefined,
      provider: parsePaymentProvider(request.query.provider),
      skip: pagination.skip,
      status: parsePaymentStatus(request.query.status),
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
    body("permitId").isUUID().withMessage("permitId must be a valid UUID"),
    body("amountInMinor")
      .isInt({ min: 1 })
      .withMessage("amountInMinor must be a positive integer"),
    body("currency")
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage("currency must be a 3-letter code"),
    body("description").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const payment = await createPayment({
      amountInMinor: Number(request.body.amountInMinor),
      currency:
        typeof request.body.currency === "string"
          ? request.body.currency
          : undefined,
      description:
        typeof request.body.description === "string"
          ? request.body.description
          : undefined,
      permitId: String(request.body.permitId),
    });

    response.status(201).json({ data: payment });
  }),
);

// GET /:id/receipt — printable HTML official receipt
router.get(
  "/:id/receipt",
  authenticate,
  authorize(...ADMIN_ROLES, "office_clerk", "business_owner"),
  param("id").isUUID().withMessage("id must be a UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const html = await getPaymentReceipt(request.params["id"] as string);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.send(html);
  }),
);

export default router;
