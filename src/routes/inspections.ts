import type {
  ChecklistResultStatus,
  FindingSeverity,
  Inspection,
} from "@prisma/client";
import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import {
  assignInspection,
  createAttachment,
  createAttachmentDownloadIntent,
  createAttachmentUploadIntent,
  createInspection,
  createFinding,
  getInspectionById,
  listInspectionMapPoints,
  getInspectionSummary,
  listInspectionHistory,
  listChecklistTemplates,
  listAttachments,
  listFindings,
  listInspections,
  listInspectionChecklistResults,
  resolveFinding,
  upsertInspectionChecklistResult,
  updateInspectionStatus,
} from "../services/inspections.js";
import { ADMIN_ROLES } from "../types/auth.js";

const router = Router();

const geoValidationRules = [
  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90"),
  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180"),
  body("accuracyMeters")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("accuracyMeters must be zero or greater"),
  body().custom((_value, { req }) => {
    const hasLatitude = req.body.latitude !== undefined;
    const hasLongitude = req.body.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      throw new Error("latitude and longitude must be provided together");
    }

    return true;
  }),
];

function parseInspectionStatus(
  value: unknown,
): Inspection["status"] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validStatuses = [
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "OVERDUE",
    "CANCELED",
  ] as const;

  if (!validStatuses.includes(normalized as (typeof validStatuses)[number])) {
    throw new AppError(400, "VALIDATION_ERROR", "status is invalid");
  }

  return normalized as Inspection["status"];
}

function parseChecklistResultStatus(
  value: unknown,
): ChecklistResultStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validStatuses = ["PASS", "FAIL", "NOT_APPLICABLE"] as const;

  if (!validStatuses.includes(normalized as (typeof validStatuses)[number])) {
    throw new AppError(400, "VALIDATION_ERROR", "checklist status is invalid");
  }

  return normalized as ChecklistResultStatus;
}

function parseFindingSeverity(value: unknown): FindingSeverity | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

  if (
    !validSeverities.includes(normalized as (typeof validSeverities)[number])
  ) {
    throw new AppError(400, "VALIDATION_ERROR", "severity is invalid");
  }

  return normalized as FindingSeverity;
}

router.get(
  "/map-points",
  authenticate,
  requireJurisdiction(),
  [
    query("from")
      .optional()
      .isISO8601()
      .withMessage("from must be a valid ISO 8601 date"),
    query("to")
      .optional()
      .isISO8601()
      .withMessage("to must be a valid ISO 8601 date"),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a valid UUID"),
    query("lguId")
      .optional()
      .isUUID()
      .withMessage("lguId must be a valid UUID"),
    query("status").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const points = await listInspectionMapPoints({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      from:
        typeof request.query.from === "string" ? request.query.from : undefined,
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      status: parseInspectionStatus(request.query.status),
      to: typeof request.query.to === "string" ? request.query.to : undefined,
    });

    response.json({ data: points });
  }),
);

router.get(
  "/summary",
  authenticate,
  requireJurisdiction(),
  [
    query("from")
      .optional()
      .isISO8601()
      .withMessage("from must be a valid ISO 8601 date"),
    query("lguId")
      .optional()
      .isUUID()
      .withMessage("lguId must be a valid UUID"),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a valid UUID"),
    query("to")
      .optional()
      .isISO8601()
      .withMessage("to must be a valid ISO 8601 date"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const summary = await getInspectionSummary({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      from:
        typeof request.query.from === "string" ? request.query.from : undefined,
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      to: typeof request.query.to === "string" ? request.query.to : undefined,
    });

    response.json({ data: summary });
  }),
);

router.get(
  "/checklist-templates",
  authenticate,
  [query("module").optional().isString(), validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const templates = await listChecklistTemplates(
      typeof request.query.module === "string"
        ? request.query.module
        : undefined,
    );

    response.json({ data: templates });
  }),
);

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
    query("businessId")
      .optional()
      .isUUID()
      .withMessage("businessId must be a valid UUID"),
    query("permitRecordId")
      .optional()
      .isUUID()
      .withMessage("permitRecordId must be a valid UUID"),
    query("inspectorId")
      .optional()
      .isUUID()
      .withMessage("inspectorId must be a valid UUID"),
    query("officeId")
      .optional()
      .isUUID()
      .withMessage("officeId must be a valid UUID"),
    query("lguId")
      .optional()
      .isUUID()
      .withMessage("lguId must be a valid UUID"),
    query("status").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listInspections({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      businessId:
        typeof request.query.businessId === "string"
          ? request.query.businessId
          : undefined,
      inspectorId:
        typeof request.query.inspectorId === "string"
          ? request.query.inspectorId
          : undefined,
      jurisdictionScope: request.jurisdictionScope ?? {
        accessScope: request.auth.role === "admin" ? "global" : "assigned",
        lguIds: [],
        officeIds: [],
      },
      limit: pagination.limit,
      lguId:
        typeof request.query.lguId === "string"
          ? request.query.lguId
          : undefined,
      officeId:
        typeof request.query.officeId === "string"
          ? request.query.officeId
          : undefined,
      page: pagination.page,
      permitRecordId:
        typeof request.query.permitRecordId === "string"
          ? request.query.permitRecordId
          : undefined,
      skip: pagination.skip,
      status: parseInspectionStatus(request.query.status),
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
    param("id").isUUID().withMessage("id must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const inspection = await getInspectionById(
      String(request.params.id),
      request.auth.role,
      request.auth.sub,
    );

    response.json({ data: inspection });
  }),
);

router.get(
  "/:id/history",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const history = await listInspectionHistory({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      inspectionId: String(request.params.id),
    });

    response.json({ data: history });
  }),
);

router.post(
  "/",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    body("businessId").isUUID().withMessage("businessId must be a valid UUID"),
    body("permitRecordId")
      .isUUID()
      .withMessage("permitRecordId must be a valid UUID"),
    body("officeId").isUUID().withMessage("officeId must be a valid UUID"),
    body("scheduledAt")
      .isISO8601()
      .withMessage("scheduledAt must be a valid ISO 8601 date"),
    body("inspectorId")
      .optional()
      .isUUID()
      .withMessage("inspectorId must be a valid UUID"),
    body("notes").optional().isString(),
    ...geoValidationRules,
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const inspection = await createInspection({
      accuracyMeters:
        typeof request.body.accuracyMeters === "number"
          ? request.body.accuracyMeters
          : undefined,
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      businessId: String(request.body.businessId),
      inspectorId:
        typeof request.body.inspectorId === "string"
          ? request.body.inspectorId
          : undefined,
      latitude:
        typeof request.body.latitude === "number"
          ? request.body.latitude
          : undefined,
      longitude:
        typeof request.body.longitude === "number"
          ? request.body.longitude
          : undefined,
      notes:
        typeof request.body.notes === "string" ? request.body.notes : undefined,
      officeId: String(request.body.officeId),
      permitRecordId: String(request.body.permitRecordId),
      scheduledAt: String(request.body.scheduledAt),
    });

    response.status(201).json({ data: inspection });
  }),
);

router.patch(
  "/:id/assignment",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("inspectorId")
      .isUUID()
      .withMessage("inspectorId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const inspection = await assignInspection({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      id: String(request.params.id),
      inspectorId: String(request.body.inspectorId),
    });

    response.json({ data: inspection });
  }),
);

router.patch(
  "/:id/status",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("status").isString().withMessage("status is required"),
    body("notes").optional().isString(),
    ...geoValidationRules,
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const inspection = await updateInspectionStatus({
      accuracyMeters:
        typeof request.body.accuracyMeters === "number"
          ? request.body.accuracyMeters
          : undefined,
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      id: String(request.params.id),
      latitude:
        typeof request.body.latitude === "number"
          ? request.body.latitude
          : undefined,
      longitude:
        typeof request.body.longitude === "number"
          ? request.body.longitude
          : undefined,
      notes:
        typeof request.body.notes === "string" ? request.body.notes : undefined,
      status: parseInspectionStatus(request.body.status) ?? "SCHEDULED",
    });

    response.json({ data: inspection });
  }),
);

router.get(
  "/:id/checklist-results",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const results = await listInspectionChecklistResults(
      String(request.params.id),
      request.auth.role,
      request.auth.sub,
    );

    response.json({ data: results });
  }),
);

router.put(
  "/:id/checklist-results/:templateId",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    param("templateId").isUUID().withMessage("templateId must be a valid UUID"),
    body("status").isString().withMessage("status is required"),
    body("remarks").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const result = await upsertInspectionChecklistResult({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      inspectionId: String(request.params.id),
      remarks:
        typeof request.body.remarks === "string"
          ? request.body.remarks
          : undefined,
      status: parseChecklistResultStatus(request.body.status) ?? "PASS",
      templateId: String(request.params.templateId),
    });

    response.json({ data: result });
  }),
);

router.get(
  "/:id/findings",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    query("severity").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const findings = await listFindings({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      inspectionId: String(request.params.id),
      severity: parseFindingSeverity(request.query.severity),
    });

    response.json({ data: findings });
  }),
);

router.post(
  "/:id/attachments/upload-intents",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("fileName")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("fileName is required"),
    body("findingId")
      .optional()
      .isUUID()
      .withMessage("findingId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const intent = await createAttachmentUploadIntent({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      fileName: String(request.body.fileName),
      findingId:
        typeof request.body.findingId === "string"
          ? request.body.findingId
          : undefined,
      inspectionId: String(request.params.id),
    });

    response.status(201).json({ data: intent });
  }),
);

router.get(
  "/:id/attachments/:attachmentId/download-intent",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    param("attachmentId")
      .isUUID()
      .withMessage("attachmentId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const intent = await createAttachmentDownloadIntent({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      attachmentId: String(request.params.attachmentId),
      inspectionId: String(request.params.id),
    });

    response.json({ data: intent });
  }),
);

router.get(
  "/:id/attachments",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    query("findingId")
      .optional()
      .isUUID()
      .withMessage("findingId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const attachments = await listAttachments({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      findingId:
        typeof request.query.findingId === "string"
          ? request.query.findingId
          : undefined,
      inspectionId: String(request.params.id),
    });

    response.json({ data: attachments });
  }),
);

router.post(
  "/:id/findings",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("severity").isString().withMessage("severity is required"),
    body("title").isString().trim().notEmpty().withMessage("title is required"),
    body("description")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("description is required"),
    body("checklistResultId")
      .optional()
      .isUUID()
      .withMessage("checklistResultId must be a valid UUID"),
    body("correctiveAction").optional().isString(),
    body("dueDate")
      .optional()
      .isISO8601()
      .withMessage("dueDate must be a valid ISO 8601 date"),
    ...geoValidationRules,
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const finding = await createFinding({
      accuracyMeters:
        typeof request.body.accuracyMeters === "number"
          ? request.body.accuracyMeters
          : undefined,
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      checklistResultId:
        typeof request.body.checklistResultId === "string"
          ? request.body.checklistResultId
          : undefined,
      correctiveAction:
        typeof request.body.correctiveAction === "string"
          ? request.body.correctiveAction
          : undefined,
      description: String(request.body.description),
      dueDate:
        typeof request.body.dueDate === "string"
          ? request.body.dueDate
          : undefined,
      inspectionId: String(request.params.id),
      latitude:
        typeof request.body.latitude === "number"
          ? request.body.latitude
          : undefined,
      longitude:
        typeof request.body.longitude === "number"
          ? request.body.longitude
          : undefined,
      severity: parseFindingSeverity(request.body.severity) ?? "LOW",
      title: String(request.body.title),
    });

    response.status(201).json({ data: finding });
  }),
);

router.post(
  "/:id/attachments",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("fileName")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("fileName is required"),
    body("mimeType")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("mimeType is required"),
    body("fileSizeBytes")
      .isInt({ min: 1 })
      .withMessage("fileSizeBytes must be a positive integer"),
    body("storageKey")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("storageKey is required"),
    body("findingId")
      .optional()
      .isUUID()
      .withMessage("findingId must be a valid UUID"),
    body("capturedAt")
      .optional()
      .isISO8601()
      .withMessage("capturedAt must be a valid ISO 8601 date"),
    ...geoValidationRules,
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const attachment = await createAttachment({
      accuracyMeters:
        typeof request.body.accuracyMeters === "number"
          ? request.body.accuracyMeters
          : undefined,
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      capturedAt:
        typeof request.body.capturedAt === "string"
          ? request.body.capturedAt
          : undefined,
      fileName: String(request.body.fileName),
      fileSizeBytes: Number(request.body.fileSizeBytes),
      findingId:
        typeof request.body.findingId === "string"
          ? request.body.findingId
          : undefined,
      inspectionId: String(request.params.id),
      latitude:
        typeof request.body.latitude === "number"
          ? request.body.latitude
          : undefined,
      longitude:
        typeof request.body.longitude === "number"
          ? request.body.longitude
          : undefined,
      mimeType: String(request.body.mimeType),
      storageKey: String(request.body.storageKey),
    });

    response.status(201).json({ data: attachment });
  }),
);

router.patch(
  "/:id/findings/:findingId/resolve",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    param("findingId").isUUID().withMessage("findingId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const finding = await resolveFinding({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      findingId: String(request.params.findingId),
      inspectionId: String(request.params.id),
    });

    response.json({ data: finding });
  }),
);

export default router;
