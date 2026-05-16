import type { IssueReportCategory } from "@prisma/client";
import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize, optionalAuthenticate } from "../middleware/auth.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  createPublicIssueReport,
  getPublicIssueReportByNumber,
  listIssueReports,
  listOwnIssueReports,
  updateIssueReportStatus,
} from "../services/issue-reports.js";
import { AppError } from "../lib/errors.js";

const router = Router();
const publicIssueReportRateLimiter = createRateLimitMiddleware({
  keyPrefix: "public-issue-report",
  limit: 20,
  windowMs: 60_000,
});

function parseIssueReportCategory(
  value: unknown,
): IssueReportCategory | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validCategories = [
    "FIRE_HAZARD",
    "SANITATION",
    "STRUCTURAL",
    "PUBLIC_SAFETY",
    "OTHER",
  ] as const;

  if (!validCategories.includes(normalized as (typeof validCategories)[number])) {
    return undefined;
  }

  return normalized as IssueReportCategory;
}

function parseIssueReportStatus(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validStatuses = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "RESOLVED",
    "DISMISSED",
  ] as const;

  if (!validStatuses.includes(normalized as (typeof validStatuses)[number])) {
    return undefined;
  }

  return normalized as (typeof validStatuses)[number];
}

router.get(
  "/public/:reportNumber",
  publicIssueReportRateLimiter,
  [
    param("reportNumber")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("reportNumber is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const reportNumber = Array.isArray(request.params.reportNumber)
      ? request.params.reportNumber[0]
      : request.params.reportNumber;

    try {
      const report = await getPublicIssueReportByNumber({ reportNumber });

      response.json({ data: report });
    } catch (error) {
      if (error instanceof Error && error.message === "ISSUE_REPORT_NOT_FOUND") {
        throw new AppError(404, "ISSUE_REPORT_NOT_FOUND", "Issue report not found");
      }

      throw error;
    }
  }),
);

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
    query("category")
      .optional()
      .isIn([
        "fire_hazard",
        "sanitation",
        "structural",
        "public_safety",
        "other",
      ])
      .withMessage("category must be a supported issue report category"),
    query("status")
      .optional()
      .isIn(["submitted", "under_review", "resolved", "dismissed"])
      .withMessage("status must be a supported issue report status"),
    query("search").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listIssueReports({
      category: parseIssueReportCategory(request.query.category),
      limit: pagination.limit,
      page: pagination.page,
      search:
        typeof request.query.search === "string"
          ? request.query.search
          : undefined,
      skip: pagination.skip,
      status: parseIssueReportStatus(request.query.status),
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
  "/mine",
  authenticate,
  authorize("citizen"),
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = parsePaginationQuery(request.query);

    const result = await listOwnIssueReports({
      limit,
      page,
      reporterUserId: request.auth!.sub,
      skip,
    });

    response.json({ data: result.data, meta: createListMeta(result.meta.total, result.meta.page, result.meta.limit) });
  }),
);

router.patch(
  "/:id/status",
  authenticate,
  [
    param("id").isString().trim().notEmpty().withMessage("id is required"),
    body("status")
      .isIn(["submitted", "under_review", "resolved", "dismissed"])
      .withMessage("status must be a supported issue report status"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;

    try {
      const issueReport = await updateIssueReportStatus({
        id,
        status: parseIssueReportStatus(request.body.status) ?? "SUBMITTED",
      });

      response.json({ data: issueReport });
    } catch (error) {
      if (error instanceof Error && error.message === "ISSUE_REPORT_NOT_FOUND") {
        throw new AppError(404, "ISSUE_REPORT_NOT_FOUND", "Issue report not found");
      }

      throw error;
    }
  }),
);

router.post(
  "/public",
  publicIssueReportRateLimiter,
  optionalAuthenticate,
  [
    body("category")
      .isIn([
        "fire_hazard",
        "sanitation",
        "structural",
        "public_safety",
        "other",
      ])
      .withMessage("category must be a supported issue report category"),
    body("subject")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("subject is required"),
    body("description")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("description is required"),
    body("locationDescription").optional().isString(),
    body("reporterName").optional().isString(),
    body("reporterEmail")
      .optional()
      .isEmail()
      .withMessage("reporterEmail must be a valid email address"),
    body("reporterPhone").optional().isString(),
    body("location.latitude").optional().isFloat({ min: -90, max: 90 }),
    body("location.longitude").optional().isFloat({ min: -180, max: 180 }),
    body("location.accuracyMeters").optional().isFloat({ min: 0 }),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const issueReport = await createPublicIssueReport({
      category: parseIssueReportCategory(request.body.category) ?? "OTHER",
      description: String(request.body.description),
      location:
        typeof request.body.location?.latitude === "number" &&
        typeof request.body.location?.longitude === "number"
          ? {
              accuracyMeters:
                typeof request.body.location.accuracyMeters === "number"
                  ? request.body.location.accuracyMeters
                  : undefined,
              latitude: request.body.location.latitude,
              longitude: request.body.location.longitude,
            }
          : undefined,
      locationDescription:
        typeof request.body.locationDescription === "string"
          ? request.body.locationDescription
          : undefined,
      reporterEmail:
        typeof request.body.reporterEmail === "string"
          ? request.body.reporterEmail
          : undefined,
      reporterName:
        typeof request.body.reporterName === "string"
          ? request.body.reporterName
          : undefined,
      reporterPhone:
        typeof request.body.reporterPhone === "string"
          ? request.body.reporterPhone
          : undefined,
      subject: String(request.body.subject),
      reporterUserId:
        request.auth?.role === "citizen" ? request.auth.sub : undefined,
    });

    response.status(201).json({ data: issueReport });
  }),
);

export default router;