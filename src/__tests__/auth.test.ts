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
const mockOfficeFindUnique = jest.fn<() => Promise<unknown>>();
const mockUserOfficeAssignmentFindFirst = jest.fn<() => Promise<unknown>>();
const mockUserOfficeAssignmentFindMany = jest.fn<() => Promise<unknown[]>>();
const mockUserOfficeAssignmentUpsert =
  jest.fn<(args: unknown) => Promise<unknown>>();
const mockUserOfficeAssignmentDelete =
  jest.fn<(args: unknown) => Promise<void>>();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
    },
    office: {
      findUnique: mockOfficeFindUnique,
    },
    user: {
      count: mockUserCount,
      create: mockUserCreate,
      findMany: mockUserFindMany,
      findUnique: mockUserFindUnique,
    },
    userOfficeAssignment: {
      delete: mockUserOfficeAssignmentDelete,
      findFirst: mockUserOfficeAssignmentFindFirst,
      findMany: mockUserOfficeAssignmentFindMany,
      upsert: mockUserOfficeAssignmentUpsert,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRateLimitStoreForTests } from "../middleware/rate-limit.js";

describe("Auth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitStoreForTests();
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

  it("lists user office assignments for an authenticated admin", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockUserOfficeAssignmentFindMany.mockResolvedValue([
      {
        createdAt,
        id: "assignment-1",
        office: {
          code: "BPLO-HQ",
          createdAt,
          description: null,
          id: "office-1",
          lguId: "lgu-1",
          name: "BPLO Headquarters",
          updatedAt: createdAt,
        },
        officeId: "office-1",
        updatedAt: createdAt,
        user: {
          email: "inspector@example.com",
          id: "user-2",
          name: "Field Inspector",
          role: "INSPECTOR",
        },
        userId: "user-2",
      },
    ]);

    const response = await request(app)
      .get("/api/v1/auth/users/user-2/office-assignments")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          createdAt: createdAt.toISOString(),
          id: "assignment-1",
          office: {
            code: "BPLO-HQ",
            id: "office-1",
            lguId: "lgu-1",
            name: "BPLO Headquarters",
          },
          user: {
            email: "inspector@example.com",
            id: "user-2",
            name: "Field Inspector",
            role: "inspector",
          },
        },
      ],
    });
  });

  it("creates a user office assignment for an authenticated admin", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockUserFindUnique.mockResolvedValue({
      createdAt,
      email: "inspector@example.com",
      id: "user-2",
      name: "Field Inspector",
      passwordHash: "ignored",
      role: "INSPECTOR",
      updatedAt: createdAt,
    });
    mockOfficeFindUnique.mockResolvedValue({
      code: "BPLO-HQ",
      createdAt,
      description: null,
      id: "11111111-1111-4111-8111-111111111111",
      lguId: "lgu-1",
      name: "BPLO Headquarters",
      updatedAt: createdAt,
    });
    mockUserOfficeAssignmentUpsert.mockResolvedValue({
      createdAt,
      id: "assignment-1",
      office: {
        code: "BPLO-HQ",
        createdAt,
        description: null,
        id: "11111111-1111-4111-8111-111111111111",
        lguId: "lgu-1",
        name: "BPLO Headquarters",
        updatedAt: createdAt,
      },
      officeId: "11111111-1111-4111-8111-111111111111",
      updatedAt: createdAt,
      user: {
        email: "inspector@example.com",
        id: "user-2",
        name: "Field Inspector",
        role: "INSPECTOR",
      },
      userId: "user-2",
    });

    const response = await request(app)
      .post("/api/v1/auth/users/user-2/office-assignments")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({ officeId: "11111111-1111-4111-8111-111111111111" });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe("assignment-1");
    expect(mockUserOfficeAssignmentUpsert).toHaveBeenCalledWith({
      create: {
        officeId: "11111111-1111-4111-8111-111111111111",
        userId: "user-2",
      },
      include: {
        office: true,
        user: {
          select: {
            email: true,
            id: true,
            name: true,
            role: true,
          },
        },
      },
      update: {},
      where: {
        userId_officeId: {
          officeId: "11111111-1111-4111-8111-111111111111",
          userId: "user-2",
        },
      },
    });
  });

  it("deletes a user office assignment for an authenticated admin", async () => {
    mockUserOfficeAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      officeId: "office-1",
      userId: "user-2",
    });
    mockUserOfficeAssignmentDelete.mockResolvedValue(undefined);

    const response = await request(app)
      .delete("/api/v1/auth/users/user-2/office-assignments/assignment-1")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      );

    expect(response.status).toBe(204);
    expect(mockUserOfficeAssignmentDelete).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
    });
  });

  it("rate limits repeated login attempts from the same client", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/api/v1/auth/login").send({
        email: "invalid-email",
        password: "short",
      });

      expect(response.status).toBe(400);
    }

    const limitedResponse = await request(app).post("/api/v1/auth/login").send({
      email: "invalid-email",
      password: "short",
    });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    });
    expect(limitedResponse.headers["retry-after"]).toEqual(expect.any(String));
  });
});
