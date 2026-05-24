import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { recordAuditLog } from "./audit-logs.js";

// ---------------------------------------------------------------------------
// Valid OAuth2 scopes
// ---------------------------------------------------------------------------

export const OAUTH_SCOPES = [
  "certificate:read",
  "permit:read",
  "compliance:read",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

export interface OAuthClientPublic {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  redirectUri: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

// ---------------------------------------------------------------------------
// Admin: register a client
// ---------------------------------------------------------------------------

export interface RegisterClientInput {
  actorUserId: string;
  description?: string;
  name: string;
  redirectUri: string;
  scopes: string[];
}

export async function registerOAuthClient(input: RegisterClientInput): Promise<{
  clientId: string;
  clientSecret: string;
  record: OAuthClientPublic;
}> {
  // Validate scopes
  const invalid = input.scopes.filter(
    (s) => !OAUTH_SCOPES.includes(s as OAuthScope),
  );

  if (invalid.length > 0) {
    throw new AppError(
      422,
      "INVALID_SCOPES",
      `Unknown scopes: ${invalid.join(", ")}`,
    );
  }

  // Validate redirect URI is HTTPS
  if (
    !input.redirectUri.startsWith("https://") &&
    !input.redirectUri.startsWith("http://localhost")
  ) {
    throw new AppError(
      422,
      "INVALID_REDIRECT_URI",
      "redirect_uri must use HTTPS (or http://localhost for development)",
    );
  }

  const clientId = crypto.randomBytes(16).toString("hex");
  const plainSecret = crypto.randomBytes(32).toString("hex");
  const hashedSecret = await bcrypt.hash(plainSecret, 10);

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecret: hashedSecret,
      description: input.description?.trim() || null,
      name: input.name.trim(),
      redirectUri: input.redirectUri.trim(),
      scopes: input.scopes,
    },
  });

  await recordAuditLog({
    action: "oauth_client.created",
    actorUserId: input.actorUserId,
    entityId: client.id,
    entityType: "oauth_client",
    summary: `OAuth2 client "${input.name}" registered`,
  });

  return {
    clientId,
    clientSecret: plainSecret, // returned once; never stored in plain text
    record: toPublicClient(client),
  };
}

// ---------------------------------------------------------------------------
// Admin: list clients
// ---------------------------------------------------------------------------

export async function listOAuthClients(): Promise<OAuthClientPublic[]> {
  const clients = await prisma.oAuthClient.findMany({
    orderBy: { createdAt: "desc" },
  });
  return clients.map(toPublicClient);
}

// ---------------------------------------------------------------------------
// Admin: delete client
// ---------------------------------------------------------------------------

export async function deleteOAuthClient(
  id: string,
  actorUserId: string,
): Promise<void> {
  const client = await prisma.oAuthClient.findUnique({ where: { id } });

  if (!client) {
    throw new AppError(404, "NOT_FOUND", "OAuth client not found");
  }

  await prisma.oAuthClient.delete({ where: { id } });

  await recordAuditLog({
    action: "oauth_client.deleted",
    actorUserId,
    entityId: id,
    entityType: "oauth_client",
    summary: `OAuth2 client "${client.name}" deleted`,
  });
}

// ---------------------------------------------------------------------------
// Public: look up client info for the consent page
// ---------------------------------------------------------------------------

export async function getOAuthClientByClientId(
  clientId: string,
): Promise<OAuthClientPublic> {
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
  });

  if (!client || !client.isActive) {
    throw new AppError(404, "CLIENT_NOT_FOUND", "OAuth client not found");
  }

  return toPublicClient(client);
}

// ---------------------------------------------------------------------------
// Create authorization code (business owner grants consent)
// ---------------------------------------------------------------------------

export interface CreateAuthCodeInput {
  clientId: string; // the public clientId string
  redirectUri: string;
  requestedScope: string[];
  userId: string; // the business owner granting consent
}

export interface ValidatedOAuthAuthorizationRequest {
  clientId: string;
  grantedScopes: string[];
  redirectUri: string;
}

export async function validateOAuthAuthorizationRequest(input: {
  clientId: string;
  redirectUri: string;
  requestedScope: string[];
}): Promise<ValidatedOAuthAuthorizationRequest> {
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: input.clientId },
  });

  if (!client || !client.isActive) {
    throw new AppError(400, "INVALID_CLIENT", "Unknown or inactive client");
  }

  if (client.redirectUri !== input.redirectUri) {
    throw new AppError(
      400,
      "REDIRECT_URI_MISMATCH",
      "redirect_uri does not match registration",
    );
  }

  const grantedScopes = input.requestedScope.filter((scope) =>
    client.scopes.includes(scope),
  );

  if (grantedScopes.length === 0) {
    throw new AppError(
      400,
      "INVALID_SCOPE",
      "None of the requested scopes are allowed for this client",
    );
  }

  return {
    clientId: client.id,
    grantedScopes,
    redirectUri: client.redirectUri,
  };
}

export async function createAuthorizationCode(
  input: CreateAuthCodeInput,
): Promise<{ code: string; redirectUri: string }> {
  const validatedRequest = await validateOAuthAuthorizationRequest({
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    requestedScope: input.requestedScope,
  });

  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId: validatedRequest.clientId,
      expiresAt,
      redirectUri: validatedRequest.redirectUri,
      scope: validatedRequest.grantedScopes,
      userId: input.userId,
    },
  });

  return { code, redirectUri: validatedRequest.redirectUri };
}

// ---------------------------------------------------------------------------
// Exchange authorization code for access token (token endpoint)
// ---------------------------------------------------------------------------

export interface ExchangeCodeInput {
  clientId: string; // public clientId
  clientSecret: string; // plain-text secret
  code: string;
  redirectUri: string;
}

export async function exchangeCodeForToken(
  input: ExchangeCodeInput,
): Promise<OAuthTokenResponse> {
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: input.clientId },
  });

  if (!client || !client.isActive) {
    throw new AppError(401, "INVALID_CLIENT", "Unknown or inactive client");
  }

  const secretMatch = await bcrypt.compare(
    input.clientSecret,
    client.clientSecret,
  );

  if (!secretMatch) {
    throw new AppError(401, "INVALID_CLIENT", "Invalid client secret");
  }

  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { code: input.code },
  });

  if (!authCode || authCode.clientId !== client.id) {
    throw new AppError(400, "INVALID_GRANT", "Authorization code not found");
  }

  if (authCode.used) {
    throw new AppError(400, "INVALID_GRANT", "Authorization code already used");
  }

  if (authCode.expiresAt < new Date()) {
    throw new AppError(400, "INVALID_GRANT", "Authorization code has expired");
  }

  if (authCode.redirectUri !== input.redirectUri) {
    throw new AppError(400, "INVALID_GRANT", "redirect_uri does not match");
  }

  // Mark code as used
  await prisma.oAuthAuthorizationCode.update({
    data: { used: true },
    where: { id: authCode.id },
  });

  // Issue access token (1-hour expiry)
  const tokenStr = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.oAuthAccessToken.create({
    data: {
      clientId: client.id,
      expiresAt,
      scope: authCode.scope,
      token: tokenStr,
      userId: authCode.userId,
    },
  });

  return {
    access_token: tokenStr,
    expires_in: 3600,
    scope: authCode.scope.join(" "),
    token_type: "Bearer",
  };
}

// ---------------------------------------------------------------------------
// Validate an OAuth access token (used by resource routes)
// ---------------------------------------------------------------------------

export interface OAuthTokenContext {
  clientId: string;
  scope: string[];
  userId: string;
}

export async function validateOAuthToken(
  bearerToken: string,
): Promise<OAuthTokenContext> {
  const token = await prisma.oAuthAccessToken.findUnique({
    where: { token: bearerToken },
  });

  if (!token) {
    throw new AppError(401, "INVALID_TOKEN", "Access token not found");
  }

  if (token.expiresAt < new Date()) {
    throw new AppError(401, "TOKEN_EXPIRED", "Access token has expired");
  }

  return {
    clientId: token.clientId,
    scope: token.scope,
    userId: token.userId,
  };
}

// ---------------------------------------------------------------------------
// Resource: read FSIC certificate (scoped to token owner's businesses)
// ---------------------------------------------------------------------------

export interface OAuthCertificateResource {
  certificateNumber: string;
  businessName: string;
  issuedAt: string;
  expiresAt: string | null;
  verificationUrl: string | null;
  status: string;
}

export async function getCertificateForOAuth(
  certificateNumber: string,
  ctx: OAuthTokenContext,
): Promise<OAuthCertificateResource> {
  if (!ctx.scope.includes("certificate:read")) {
    throw new AppError(
      403,
      "INSUFFICIENT_SCOPE",
      "Token does not have certificate:read scope",
    );
  }

  const cert = await prisma.fireSafetyCertificate.findUnique({
    include: {
      inspection: {
        include: {
          permitRecord: {
            include: { business: true },
          },
        },
      },
    },
    where: { certificateNumber },
  });

  if (!cert) {
    throw new AppError(404, "NOT_FOUND", "Certificate not found");
  }

  // Verify the certificate belongs to a business owned by the token's user
  const business = cert.inspection.permitRecord?.business;

  if (!business) {
    throw new AppError(404, "NOT_FOUND", "Certificate not found");
  }

  const owner = await prisma.user.findFirst({
    where: { businessId: business.id, id: ctx.userId },
  });

  if (!owner) {
    throw new AppError(
      403,
      "ACCESS_DENIED",
      "Token owner does not own this certificate's business",
    );
  }

  return {
    businessName: business.businessName,
    certificateNumber: cert.certificateNumber,
    expiresAt: cert.expiresAt?.toISOString() ?? null,
    issuedAt: cert.issuedAt.toISOString(),
    status: cert.status,
    verificationUrl: cert.verificationUrl ?? null,
  };
}

// ---------------------------------------------------------------------------
// Resource: read compliance score (scoped to token owner)
// ---------------------------------------------------------------------------

export async function getComplianceForOAuth(
  businessId: string,
  ctx: OAuthTokenContext,
): Promise<{
  businessId: string;
  businessName: string;
  score: number;
  grade: string;
}> {
  if (!ctx.scope.includes("compliance:read")) {
    throw new AppError(
      403,
      "INSUFFICIENT_SCOPE",
      "Token does not have compliance:read scope",
    );
  }

  // Check ownership
  const user = await prisma.user.findFirst({
    where: { businessId, id: ctx.userId },
  });

  if (!user) {
    throw new AppError(
      403,
      "ACCESS_DENIED",
      "Token owner does not own this business",
    );
  }

  const business = await prisma.businessEstablishment.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(404, "NOT_FOUND", "Business not found");
  }

  // Lazy import to avoid circular deps
  const { computeComplianceScore } = await import("./compliance-score.js");
  const result = await computeComplianceScore(businessId);

  return {
    businessId,
    businessName: business.businessName,
    grade: result.grade,
    score: result.score,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPublicClient(client: {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  redirectUri: string;
  scopes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): OAuthClientPublic {
  return {
    clientId: client.clientId,
    createdAt: client.createdAt.toISOString(),
    description: client.description ?? undefined,
    id: client.id,
    isActive: client.isActive,
    name: client.name,
    redirectUri: client.redirectUri,
    scopes: client.scopes,
    updatedAt: client.updatedAt.toISOString(),
  };
}
