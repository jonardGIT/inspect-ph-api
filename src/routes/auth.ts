import { Router } from "express";
import { body, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  bootstrapAdmin,
  getCurrentUser,
  listUsers,
  login,
  refreshSession,
} from "../services/auth.js";
import {
  ADMIN_ROLES,
  normalizeUserRoleInput,
  USER_ROLES,
} from "../types/auth.js";

const router = Router();

const emailValidator = body("email")
  .isEmail()
  .withMessage("A valid email address is required");
const passwordValidator = body("password")
  .isString()
  .isLength({ min: 8 })
  .withMessage("Password must be at least 8 characters long");

router.post(
  "/bootstrap-admin",
  [
    emailValidator,
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    passwordValidator,
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await bootstrapAdmin({
      email: String(request.body.email),
      name: String(request.body.name),
      password: String(request.body.password),
    });

    response.status(201).json({ data: result });
  }),
);

router.post(
  "/login",
  [emailValidator, passwordValidator, validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const result = await login({
      email: String(request.body.email),
      password: String(request.body.password),
    });

    response.json({ data: result });
  }),
);

router.post(
  "/refresh",
  [
    body("refreshToken")
      .isString()
      .notEmpty()
      .withMessage("refreshToken is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await refreshSession({
      refreshToken: String(request.body.refreshToken),
    });

    response.json({ data: result });
  }),
);

router.get(
  "/users",
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
    query("role").optional().isIn(USER_ROLES).withMessage("role is invalid"),
    query("search").optional().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const pagination = parsePaginationQuery(
      request.query as Record<string, unknown>,
    );
    const result = await listUsers({
      limit: pagination.limit,
      page: pagination.page,
      role:
        typeof request.query.role === "string"
          ? (normalizeUserRoleInput(request.query.role) ?? undefined)
          : undefined,
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
  "/me",
  authenticate,
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const user = await getCurrentUser(request.auth.sub);

    response.json({ data: user });
  }),
);

export default router;
