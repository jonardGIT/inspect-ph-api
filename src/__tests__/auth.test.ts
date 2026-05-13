import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

interface MockUserRecord {
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  passwordHash: string;
  role: "ADMIN" | "INSPECTOR";
  updatedAt: Date;
}

type CreateUserArgs = {
  data: {
    email: string;
    name: string;
    passwordHash: string;
    role: "ADMIN";
  };
};

const mockUserCount = jest.fn<() => Promise<number>>();
const mockAuditLogCreate = jest.fn<(args: unknown) => Promise<void>>();
const mockUserCreate =
  jest.fn<(args: CreateUserArgs) => Promise<MockUserRecord>>();
const mockUserFindMany = jest.fn<() => Promise<MockUserRecord[]>>();
const mockUserFindUnique = jest.fn<() => Promise<MockUserRecord | null>>();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
    },
    user: {
      count: mockUserCount,
      create: mockUserCreate,
      findMany: mockUserFindMany,
      findUnique: mockUserFindUnique,
    },
  },
}));

import app from "../app.js";

describe("Auth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue(undefined);
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    process.env.BCRYPT_SALT_ROUNDS = "4";
  });

  it("bootstraps the first admin account", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockUserCount.mockResolvedValue(0);
    mockUserCreate.mockImplementation(async ({ data }) => ({
      createdAt,
      email: data.email,
      id: "user-1",
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role,
      updatedAt: createdAt,
    }));

    const response = await request(app)
      .post("/api/v1/auth/bootstrap-admin")
      .send({
        email: "admin@example.com",
        name: "System Admin",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toEqual({
      createdAt: createdAt.toISOString(),
      email: "admin@example.com",
      id: "user-1",
      name: "System Admin",
      role: "admin",
    });
    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.expiresIn).toBe(900);
    expect(mockUserCreate.mock.calls[0][0].data.passwordHash).not.toBe(
      "password123",
    );
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "auth.bootstrap_admin",
        actorUserId: "user-1",
        entityId: "user-1",
        entityType: "user",
      }),
    });
  });

  it("rejects invalid login payloads", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "invalid-email",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns tokens for valid credentials", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");
    const { hashPassword } = await import("../lib/password.js");

    mockUserFindUnique.mockResolvedValue({
      createdAt,
      email: "inspector@example.com",
      id: "user-2",
      name: "Field Inspector",
      passwordHash: await hashPassword("password123"),
      role: "INSPECTOR",
      updatedAt: createdAt,
    });

    const response = await request(app).post("/api/v1/auth/login").send({
      email: "inspector@example.com",
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({
      createdAt: createdAt.toISOString(),
      email: "inspector@example.com",
      id: "user-2",
      name: "Field Inspector",
      role: "inspector",
    });
    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "auth.login",
        actorUserId: "user-2",
        entityId: "user-2",
        entityType: "user",
      }),
    });
  });

  it("rejects unauthenticated requests to the current user endpoint", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        details: undefined,
        message: "Authentication failed",
      },
    });
  });

  it("returns the current user for a valid access token", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");
    const { signAccessToken } = await import("../lib/jwt.js");

    mockUserFindUnique.mockResolvedValue({
      createdAt,
      email: "admin@example.com",
      id: "user-1",
      name: "System Admin",
      passwordHash: "ignored",
      role: "ADMIN",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        createdAt: createdAt.toISOString(),
        email: "admin@example.com",
        id: "user-1",
        name: "System Admin",
        role: "admin",
      },
    });
  });

  it("lists inspector users for an authenticated admin", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");
    const { signAccessToken } = await import("../lib/jwt.js");

    mockUserCount.mockResolvedValue(1);
    mockUserFindMany.mockResolvedValue([
      {
        createdAt,
        email: "inspector@example.com",
        id: "user-2",
        name: "Field Inspector",
        passwordHash: "ignored",
        role: "INSPECTOR",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/auth/users")
      .query({ role: "inspector", search: "field" })
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          createdAt: createdAt.toISOString(),
          email: "inspector@example.com",
          id: "user-2",
          name: "Field Inspector",
          role: "inspector",
        },
      ],
      meta: {
        limit: 20,
        page: 1,
        total: 1,
      },
    });
    expect(mockUserFindMany).toHaveBeenCalled();
  });

  it("rejects inspector access to the user lookup endpoint", async () => {
    const { signAccessToken } = await import("../lib/jwt.js");

    const response = await request(app)
      .get("/api/v1/auth/users")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
