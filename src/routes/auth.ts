import type { Request } from "express";
import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  bootstrapAdmin,
  getCurrentUser,
  listUsers,
  login,
  refreshSession,
  registerUser,
  updateExpoPushToken,
} from "../services/auth.js";
import {
  listAuthSessions,
  revokeAuthSession,
} from "../services/auth-sessions.js";
import {
  createUserOfficeAssignment,
  deleteUserOfficeAssignment,
  listUserOfficeAssignments,
} from "../services/user-office-assignments.js";
import {
  ADMIN_ROLES,
  normalizeUserRoleInput,
  USER_ROLES,
} from "../types/auth.js";

const router = Router();
const authRateLimiter = createRateLimitMiddleware({
  keyPrefix: "auth",
  limit: 5,
  windowMs: 60_000,
});

const emailValidator = body("email")
  .isEmail()
  .withMessage("A valid email address is required");
const passwordValidator = body("password")
  .isString()
  .isLength({ min: 8 })
  .withMessage("Password must be at least 8 characters long");

function getRequestSessionContext(request: Request) {
  return {
    ipAddress: request.ip || undefined,
    userAgent: request.header("user-agent") || undefined,
  };
}

router.post(
  "/bootstrap-admin",
  authRateLimiter,
  [
    emailValidator,
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    passwordValidator,
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await bootstrapAdmin(
      {
        email: String(request.body.email),
        name: String(request.body.name),
        password: String(request.body.password),
      },
      getRequestSessionContext(request),
    );

    response.status(201).json({ data: result });
  }),
);

router.post(
  "/login",
  authRateLimiter,
  [emailValidator, passwordValidator, validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const result = await login(
      {
        email: String(request.body.email),
        password: String(request.body.password),
      },
      getRequestSessionContext(request),
    );

    response.json({ data: result });
  }),
);

router.post(
  "/refresh",
  authRateLimiter,
  [
    body("refreshToken")
      .isString()
      .notEmpty()
      .withMessage("refreshToken is required"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await refreshSession({
      ipAddress: request.ip || undefined,
      refreshToken: String(request.body.refreshToken),
      userAgent: request.header("user-agent") || undefined,
    });

    response.json({ data: result });
  }),
);

router.get(
  "/sessions",
  authenticate,
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const sessions = await listAuthSessions({
      currentSessionId: request.auth.sid,
      userId: request.auth.sub,
    });

    response.json({ data: sessions });
  }),
);

router.delete(
  "/sessions/:sessionId",
  authenticate,
  [
    param("sessionId").isUUID().withMessage("sessionId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    const sessionId = Array.isArray(request.params.sessionId)
      ? request.params.sessionId[0]
      : request.params.sessionId;

    await revokeAuthSession({
      actorRole: request.auth.role,
      actorUserId: request.auth.sub,
      sessionId,
    });

    response.status(204).send();
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
  "/users/:id/sessions",
  authenticate,
  authorize(...ADMIN_ROLES),
  [validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const userId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const sessions = await listAuthSessions({
      currentSessionId: request.auth?.sid,
      userId,
    });

    response.json({ data: sessions });
  }),
);

router.get(
  "/users/:id/office-assignments",
  authenticate,
  authorize(...ADMIN_ROLES),
  [validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const userId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const assignments = await listUserOfficeAssignments(userId);

    response.json({ data: assignments });
  }),
);

router.post(
  "/users/:id/office-assignments",
  authenticate,
  authorize(...ADMIN_ROLES),
  [
    body("officeId").isUUID().withMessage("officeId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const userId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const assignment = await createUserOfficeAssignment({
      officeId: String(request.body.officeId),
      userId,
    });

    response.status(201).json({ data: assignment });
  }),
);

router.delete(
  "/users/:id/office-assignments/:assignmentId",
  authenticate,
  authorize(...ADMIN_ROLES),
  [validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const userId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const assignmentId = Array.isArray(request.params.assignmentId)
      ? request.params.assignmentId[0]
      : request.params.assignmentId;

    await deleteUserOfficeAssignment({ assignmentId, userId });

    response.status(204).send();
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

// Register or update the caller's Expo push token for mobile notifications
router.post(
  "/push-token",
  authenticate,
  [
    body("token")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("token must be a non-empty string"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      return;
    }

    await updateExpoPushToken(request.auth.sub, String(request.body.token));

    response.status(204).send();
  }),
);

// Public self-registration for business_owner and citizen accounts
const registerRateLimiter = createRateLimitMiddleware({
  keyPrefix: "auth-register",
  limit: 5,
  windowMs: 60_000,
});

router.post(
  "/register",
  registerRateLimiter,
  [
    emailValidator,
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    passwordValidator,
    body("role")
      .isIn(["business_owner", "citizen"])
      .withMessage("role must be business_owner or citizen"),
    body("businessId")
      .optional()
      .isUUID()
      .withMessage("businessId must be a valid UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const result = await registerUser(
      {
        email: String(request.body.email),
        name: String(request.body.name),
        password: String(request.body.password),
        role: String(request.body.role) as "business_owner" | "citizen",
        businessId:
          typeof request.body.businessId === "string"
            ? request.body.businessId
            : undefined,
      },
      getRequestSessionContext(request),
    );

    response.status(201).json({ data: result });
  }),
);

export default router;
