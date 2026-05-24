import { Router } from "express";
import { body, param, query } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createAuthorizationCode,
  deleteOAuthClient,
  exchangeCodeForToken,
  getCertificateForOAuth,
  getComplianceForOAuth,
  getOAuthClientByClientId,
  listOAuthClients,
  OAUTH_SCOPES,
  registerOAuthClient,
  validateOAuthAuthorizationRequest,
  validateOAuthToken,
} from "../services/oauth.js";

const router = Router();

// ---------------------------------------------------------------------------
// Admin: list registered OAuth clients
// ---------------------------------------------------------------------------

router.get(
  "/clients",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_request, response) => {
    const clients = await listOAuthClients();
    response.json({ data: clients });
  }),
);

// ---------------------------------------------------------------------------
// Admin: register a new client
// ---------------------------------------------------------------------------

router.post(
  "/clients",
  authenticate,
  authorize("admin"),
  [
    body("name").notEmpty().isString().withMessage("name is required"),
    body("description").optional().isString(),
    body("redirectUri")
      .notEmpty()
      .isString()
      .withMessage("redirectUri is required"),
    body("scopes")
      .isArray({ min: 1 })
      .withMessage("scopes must be a non-empty array")
      .custom((v: unknown[]) =>
        v.every((s) => OAUTH_SCOPES.includes(s as never)),
      )
      .withMessage(`scopes must be subset of: ${OAUTH_SCOPES.join(", ")}`),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await registerOAuthClient({
      actorUserId: request.auth.sub,
      description:
        typeof request.body.description === "string"
          ? request.body.description
          : undefined,
      name: String(request.body.name),
      redirectUri: String(request.body.redirectUri),
      scopes: request.body.scopes as string[],
    });

    // Return the plain-text secret exactly once
    response.status(201).json({
      data: result.record,
      clientSecret: result.clientSecret,
      warning: "Store the clientSecret securely — it will not be shown again.",
    });
  }),
);

// ---------------------------------------------------------------------------
// Admin: delete client
// ---------------------------------------------------------------------------

router.delete(
  "/clients/:id",
  authenticate,
  authorize("admin"),
  [
    param("id").isUUID().withMessage("id must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    await deleteOAuthClient(String(request.params["id"]), request.auth.sub);
    response.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Public: get client info for the consent page (no auth required)
// ---------------------------------------------------------------------------

router.get(
  "/clients/:clientId/info",
  [param("clientId").isString().notEmpty(), validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const info = await getOAuthClientByClientId(
      String(request.params["clientId"]),
    );
    // Only expose safe fields
    response.json({
      data: {
        clientId: info.clientId,
        description: info.description,
        name: info.name,
        redirectUri: info.redirectUri,
        scopes: info.scopes,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /oauth/authorize — business owner grants or denies consent
// Returns { code, state } on approval; third party captures the redirect
// ---------------------------------------------------------------------------

router.post(
  "/authorize",
  authenticate,
  authorize("business_owner"),
  [
    body("client_id").notEmpty().isString(),
    body("redirect_uri").notEmpty().isString(),
    body("scope")
      .notEmpty()
      .isString()
      .withMessage("scope must be a space-separated string"),
    body("state").optional().isString(),
    body("decision")
      .isIn(["approve", "deny"])
      .withMessage("decision must be 'approve' or 'deny'"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    if (!request.auth) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { client_id, redirect_uri, scope, state, decision } =
      request.body as {
        client_id: string;
        decision: "approve" | "deny";
        redirect_uri: string;
        scope: string;
        state?: string;
      };

    const requestedScopes = scope.split(" ").filter(Boolean);

    if (decision === "deny") {
      const authorizationRequest = await validateOAuthAuthorizationRequest({
        clientId: client_id,
        redirectUri: redirect_uri,
        requestedScope: requestedScopes,
      });

      response.json({
        data: {
          redirectUri: `${authorizationRequest.redirectUri}?error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`,
        },
      });
      return;
    }

    const { code, redirectUri } = await createAuthorizationCode({
      clientId: client_id,
      redirectUri: redirect_uri,
      requestedScope: requestedScopes,
      userId: request.auth.sub,
    });

    const redirectUrl =
      `${redirectUri}?code=${code}` +
      (state ? `&state=${encodeURIComponent(state)}` : "");

    response.json({ data: { redirectUri: redirectUrl } });
  }),
);

// ---------------------------------------------------------------------------
// POST /oauth/token — exchange authorization code for access token
// (unauthenticated; secured by client_id + client_secret)
// ---------------------------------------------------------------------------

router.post(
  "/token",
  [
    body("grant_type")
      .equals("authorization_code")
      .withMessage("Only authorization_code grant is supported"),
    body("code").notEmpty().isString(),
    body("redirect_uri").notEmpty().isString(),
    body("client_id").notEmpty().isString(),
    body("client_secret").notEmpty().isString(),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const {
      grant_type: _gt,
      code,
      redirect_uri,
      client_id,
      client_secret,
    } = request.body as {
      code: string;
      client_id: string;
      client_secret: string;
      grant_type: string;
      redirect_uri: string;
    };

    const tokenResponse = await exchangeCodeForToken({
      clientId: client_id,
      clientSecret: client_secret,
      code,
      redirectUri: redirect_uri,
    });

    response.json(tokenResponse);
  }),
);

// ---------------------------------------------------------------------------
// Resource routes — secured by OAuth access token
// ---------------------------------------------------------------------------

async function extractOAuthBearer(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "MISSING_TOKEN", "Bearer token required");
  }
  return validateOAuthToken(authHeader.slice(7));
}

// GET /oauth/resources/certificates/:certificateNumber
router.get(
  "/resources/certificates/:certificateNumber",
  [param("certificateNumber").isString().notEmpty(), validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const ctx = await extractOAuthBearer(request.headers.authorization);
    const cert = await getCertificateForOAuth(
      String(request.params["certificateNumber"]),
      ctx,
    );
    response.json({ data: cert });
  }),
);

// GET /oauth/resources/compliance/:businessId
router.get(
  "/resources/compliance/:businessId",
  [
    param("businessId").isUUID().withMessage("businessId must be a UUID"),
    validateRequestMiddleware,
  ],
  asyncHandler(async (request, response) => {
    const ctx = await extractOAuthBearer(request.headers.authorization);
    const result = await getComplianceForOAuth(
      String(request.params["businessId"]),
      ctx,
    );
    response.json({ data: result });
  }),
);

export { router as oauthRouter };
