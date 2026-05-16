import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { requireJurisdiction } from "../middleware/jurisdiction.js";
import {
  archiveBusiness,
  createBusiness,
  getBusiness,
  listBusinesses,
  updateBusiness,
} from "../services/businesses.js";
import { computeComplianceScore } from "../services/compliance-score.js";
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
    query("city").optional().isString(),
    query("barangay").optional().isString(),
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
    const result = await listBusinesses({
      barangay:
        typeof request.query.barangay === "string"
          ? request.query.barangay
          : undefined,
      city:
        typeof request.query.city === "string" ? request.query.city : undefined,
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
    body("businessName")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("businessName is required"),
    body("ownerName")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("ownerName is required"),
    body("addressLine")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("addressLine is required"),
    body("barangay")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("barangay is required"),
    body("city").isString().trim().notEmpty().withMessage("city is required"),
    body("province")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("province is required"),
    body("tradeName").optional().isString(),
    body("taxIdentificationNumber").optional().isString(),
    body("contactNumber").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const business = await createBusiness({
      addressLine: String(request.body.addressLine),
      barangay: String(request.body.barangay),
      businessName: String(request.body.businessName),
      city: String(request.body.city),
      contactNumber:
        typeof request.body.contactNumber === "string"
          ? request.body.contactNumber
          : undefined,
      ownerName: String(request.body.ownerName),
      province: String(request.body.province),
      taxIdentificationNumber:
        typeof request.body.taxIdentificationNumber === "string"
          ? request.body.taxIdentificationNumber
          : undefined,
      tradeName:
        typeof request.body.tradeName === "string"
          ? request.body.tradeName
          : undefined,
    });

    response.status(201).json({ data: business });
  }),
);

router.get(
  "/:id",
  authenticate,
  requireJurisdiction(),
  param("id").isUUID().withMessage("id must be a valid UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const business = await getBusiness(request.params["id"] as string);
    response.json({ data: business });
  }),
);

router.patch(
  "/:id",
  authenticate,
  authorize("admin", "lgu_admin"),
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("businessName").optional().isString().trim().notEmpty(),
    body("ownerName").optional().isString().trim().notEmpty(),
    body("addressLine").optional().isString().trim().notEmpty(),
    body("barangay").optional().isString().trim().notEmpty(),
    body("city").optional().isString().trim().notEmpty(),
    body("province").optional().isString().trim().notEmpty(),
    body("tradeName").optional().isString(),
    body("taxIdentificationNumber").optional().isString(),
    body("contactNumber").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const business = await updateBusiness(request.params["id"] as string, {
      addressLine:
        typeof request.body.addressLine === "string"
          ? request.body.addressLine
          : undefined,
      barangay:
        typeof request.body.barangay === "string"
          ? request.body.barangay
          : undefined,
      businessName:
        typeof request.body.businessName === "string"
          ? request.body.businessName
          : undefined,
      city:
        typeof request.body.city === "string" ? request.body.city : undefined,
      contactNumber:
        "contactNumber" in request.body
          ? (request.body.contactNumber as string | null)
          : undefined,
      ownerName:
        typeof request.body.ownerName === "string"
          ? request.body.ownerName
          : undefined,
      province:
        typeof request.body.province === "string"
          ? request.body.province
          : undefined,
      taxIdentificationNumber:
        "taxIdentificationNumber" in request.body
          ? (request.body.taxIdentificationNumber as string | null)
          : undefined,
      tradeName:
        "tradeName" in request.body
          ? (request.body.tradeName as string | null)
          : undefined,
    });
    response.json({ data: business });
  }),
);

router.patch(
  "/:id/archive",
  authenticate,
  authorize(...ADMIN_ROLES),
  param("id").isUUID().withMessage("id must be a valid UUID"),
  validateRequestMiddleware,
  asyncHandler(async (request, response) => {
    const business = await archiveBusiness(request.params["id"] as string);
    response.json({ data: business });
  }),
);

router.get(
  "/:id/compliance-score",
  authenticate,
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await computeComplianceScore(String(request.params["id"]));
    response.json({ data: result });
  }),
);

export default router;
