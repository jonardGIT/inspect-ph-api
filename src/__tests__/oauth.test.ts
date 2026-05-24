import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";

const mockAuditLogCreate = jest.fn<(args: unknown) => Promise<void>>();
const mockOAuthAccessTokenCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const mockOAuthAuthorizationCodeCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const mockOAuthAuthorizationCodeFindUnique = jest.fn<() => Promise<unknown>>();
const mockOAuthAuthorizationCodeUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const mockOAuthClientDelete = jest.fn<(args: unknown) => Promise<void>>();
const mockOAuthClientFindMany = jest.fn<() => Promise<unknown[]>>();
const mockOAuthClientFindUnique = jest.fn<() => Promise<unknown>>();
const mockOAuthClientCreate = jest.fn<(args: unknown) => Promise<unknown>>();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
    },
    oAuthAccessToken: {
      create: mockOAuthAccessTokenCreate,
    },
    oAuthAuthorizationCode: {
      create: mockOAuthAuthorizationCodeCreate,
      findUnique: mockOAuthAuthorizationCodeFindUnique,
      update: mockOAuthAuthorizationCodeUpdate,
    },
    oAuthClient: {
      create: mockOAuthClientCreate,
      delete: mockOAuthClientDelete,
      findMany: mockOAuthClientFindMany,
      findUnique: mockOAuthClientFindUnique,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRateLimitStoreForTests } from "../middleware/rate-limit.js";

function createOAuthClientRecord() {
  return {
    clientId: "client-123",
    clientSecret: bcrypt.hashSync("plain-secret", 4),
    createdAt: new Date("2026-05-20T00:00:00.000Z"),
    description: "Partner integration",
    id: "oauth-client-db-id",
    isActive: true,
    name: "Partner App",
    redirectUri: "https://partner.example/callback",
    scopes: ["permit:read"],
    updatedAt: new Date("2026-05-20T00:00:00.000Z"),
  };
}

describe("OAuth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitStoreForTests();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    mockAuditLogCreate.mockResolvedValue(undefined);
    mockOAuthAccessTokenCreate.mockResolvedValue(undefined);
    mockOAuthAuthorizationCodeCreate.mockResolvedValue(undefined);
    mockOAuthAuthorizationCodeFindUnique.mockResolvedValue(null);
    mockOAuthAuthorizationCodeUpdate.mockResolvedValue(undefined);
    mockOAuthClientCreate.mockResolvedValue(undefined);
    mockOAuthClientDelete.mockResolvedValue(undefined);
    mockOAuthClientFindMany.mockResolvedValue([]);
  });

  it("rejects consent denial when redirect_uri does not match the registered client", async () => {
    const token = signAccessToken({ role: "business_owner", sub: "user-123" });

    mockOAuthClientFindUnique.mockResolvedValue(createOAuthClientRecord());

    const response = await request(app)
      .post("/api/v1/oauth/authorize")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: "client-123",
        decision: "deny",
        redirect_uri: "https://attacker.example/callback",
        scope: "permit:read",
        state: "abc123",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REDIRECT_URI_MISMATCH");
    expect(mockOAuthAuthorizationCodeCreate).not.toHaveBeenCalled();
  });

  it("returns the registered redirect URI when denying a valid request", async () => {
    const token = signAccessToken({ role: "business_owner", sub: "user-123" });

    mockOAuthClientFindUnique.mockResolvedValue(createOAuthClientRecord());

    const response = await request(app)
      .post("/api/v1/oauth/authorize")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: "client-123",
        decision: "deny",
        redirect_uri: "https://partner.example/callback",
        scope: "permit:read",
        state: "abc123",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.redirectUri).toBe(
      "https://partner.example/callback?error=access_denied&state=abc123",
    );
    expect(mockOAuthAuthorizationCodeCreate).not.toHaveBeenCalled();
  });

  it("creates an authorization code and redirects with code and state on approval", async () => {
    const token = signAccessToken({ role: "business_owner", sub: "user-123" });

    mockOAuthClientFindUnique.mockResolvedValue(createOAuthClientRecord());
    mockOAuthAuthorizationCodeCreate.mockResolvedValue({
      clientId: "oauth-client-db-id",
      code: "generated-code",
      id: "auth-code-id",
    });

    const response = await request(app)
      .post("/api/v1/oauth/authorize")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: "client-123",
        decision: "approve",
        redirect_uri: "https://partner.example/callback",
        scope: "permit:read",
        state: "abc123",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.redirectUri).toMatch(
      /^https:\/\/partner\.example\/callback\?code=[a-f0-9]+&state=abc123$/,
    );
    expect(mockOAuthAuthorizationCodeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: "oauth-client-db-id",
        redirectUri: "https://partner.example/callback",
        scope: ["permit:read"],
        userId: "user-123",
      }),
    });
  });

  it("exchanges an authorization code for an access token", async () => {
    mockOAuthClientFindUnique.mockResolvedValue(createOAuthClientRecord());
    mockOAuthAuthorizationCodeFindUnique.mockResolvedValue({
      clientId: "oauth-client-db-id",
      code: "authorization-code",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      id: "auth-code-id",
      redirectUri: "https://partner.example/callback",
      scope: ["permit:read"],
      used: false,
      userId: "user-123",
    });
    mockOAuthAuthorizationCodeUpdate.mockResolvedValue({
      id: "auth-code-id",
      used: true,
    });
    mockOAuthAccessTokenCreate.mockResolvedValue({ id: "access-token-id" });

    const response = await request(app)
      .post("/api/v1/oauth/token")
      .send({
        client_id: "client-123",
        client_secret: "plain-secret",
        code: "authorization-code",
        grant_type: "authorization_code",
        redirect_uri: "https://partner.example/callback",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      access_token: expect.any(String),
      expires_in: 3600,
      scope: "permit:read",
      token_type: "Bearer",
    });
    expect(mockOAuthAuthorizationCodeUpdate).toHaveBeenCalledWith({
      data: { used: true },
      where: { id: "auth-code-id" },
    });
    expect(mockOAuthAccessTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: "oauth-client-db-id",
        scope: ["permit:read"],
        userId: "user-123",
      }),
    });
  });
});