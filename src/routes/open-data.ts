import { Router } from "express";
import { query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  getOpenDataCompliance,
  getOpenDataFees,
  getOpenDataInspections,
} from "../services/open-data.js";

const router = Router();

// Stricter public rate limit — 20 requests per minute per IP
const openDataRateLimiter = createRateLimitMiddleware({
  keyPrefix: "open-data",
  limit: 20,
  windowMs: 60_000,
});

// Common validators reused across endpoints
const dateRangeValidators = [
  query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
  query("fromDate")
    .optional()
    .isISO8601()
    .withMessage("fromDate must be ISO 8601"),
  query("toDate").optional().isISO8601().withMessage("toDate must be ISO 8601"),
];

// GET /open-data/compliance
router.get(
  "/compliance",
  openDataRateLimiter,
  [
    query("lguId").optional().isUUID().withMessage("lguId must be a UUID"),
    query("region").optional().isString().trim(),
    query("province").optional().isString().trim(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    response.setHeader("X-Attribution-Required", "true");
    response.setHeader("Cache-Control", "public, max-age=3600");

    const result = await getOpenDataCompliance({
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      region:
        typeof request.query.region === "string"
          ? request.query.region
          : undefined,
      province:
        typeof request.query.province === "string"
          ? request.query.province
          : undefined,
    });

    response.json(result);
  }),
);

// GET /open-data/inspections
router.get(
  "/inspections",
  openDataRateLimiter,
  [...dateRangeValidators, validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    response.setHeader("X-Attribution-Required", "true");
    response.setHeader("Cache-Control", "public, max-age=3600");

    const result = await getOpenDataInspections({
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
    });

    response.json(result);
  }),
);

// GET /open-data/fees
router.get(
  "/fees",
  openDataRateLimiter,
  [...dateRangeValidators, validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    response.setHeader("X-Attribution-Required", "true");
    response.setHeader("Cache-Control", "public, max-age=3600");

    const result = await getOpenDataFees({
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      fromDate:
        typeof request.query.fromDate === "string"
          ? request.query.fromDate
          : undefined,
      toDate:
        typeof request.query.toDate === "string"
          ? request.query.toDate
          : undefined,
    });

    response.json(result);
  }),
);

export default router;
