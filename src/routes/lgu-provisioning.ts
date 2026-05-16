import { Router } from "express";
import { body } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { provisionLgu } from "../services/lgu-provisioning.js";

const router = Router();

// POST /admin/provision-lgu — ADMIN only; provision a new LGU with office + admin user
router.post(
  "/provision-lgu",
  authenticate,
  authorize("admin"),
  [
    body("lguName")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage("lguName is required (max 200 characters)"),
    body("lguCode")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 50 })
      .withMessage("lguCode is required (max 50 characters)"),
    body("regionCode")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("regionCode max 100 characters"),
    body("offices")
      .isArray({ min: 1 })
      .withMessage("offices must be a non-empty array"),
    body("offices.*.name")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage("offices[*].name is required"),
    body("offices.*.code")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 50 })
      .withMessage("offices[*].code is required"),
    body("offices.*.moduleIds")
      .isArray()
      .withMessage("offices[*].moduleIds must be an array"),
    body("offices.*.moduleIds.*")
      .isUUID()
      .withMessage("offices[*].moduleIds entries must be UUIDs"),
    body("adminName")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage("adminName is required"),
    body("adminEmail")
      .isEmail()
      .normalizeEmail()
      .withMessage("adminEmail must be a valid email address"),
    body("adminPassword")
      .isString()
      .isLength({ min: 8 })
      .withMessage("adminPassword must be at least 8 characters"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await provisionLgu(
      {
        adminEmail: request.body.adminEmail as string,
        adminName: request.body.adminName as string,
        adminPassword: request.body.adminPassword as string,
        lguCode: request.body.lguCode as string,
        lguName: request.body.lguName as string,
        offices: request.body.offices as Array<{
          code: string;
          moduleIds: string[];
          name: string;
        }>,
        region: request.body.regionCode as string | undefined,
      },
      request.auth!.sub,
    );

    response.status(201).json({ data: result });
  }),
);

export default router;
