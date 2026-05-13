import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

interface MockAuditLogRecord {
  action: string;
  actor: {
    email: string;
    id: string;
    name: string;
    role: "ADMIN" | "INSPECTOR";
  } | null;
  createdAt: Date;
  detail: string | null;
  entityId: string | null;
  entityType: string;
  id: string;
  summary: string;
}

const mockAuditLogCount = jest.fn<() => Promise<number>>();
const mockAuditLogFindMany = jest.fn<
  (...args: unknown[]) => Promise<MockAuditLogRecord[]>
>();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      count: mockAuditLogCount,
      findMany: mockAuditLogFindMany,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Audit log routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists audit log entries for authenticated admins", async () => {
    const createdAt = new Date("2026-05-13T10:00:00.000Z");

    mockAuditLogCount.mockResolvedValue(1);
    mockAuditLogFindMany.mockResolvedValue([
      {
        action: "inspection.created",
        actor: {
          email: "admin@example.com",
          id: "user-1",
          name: "System Admin",
          role: "ADMIN",
        },
        createdAt,
        detail: "Assigned to inspector inspector-1",
        entityId: "inspection-1",
        entityType: "inspection",
        id: "audit-1",
        summary: "Scheduled inspection for Acme Foods",
      },
    ]);

    const response = await request(app)
      .get("/api/v1/audit-logs")
      .query({
        action: "inspection.created",
        entityType: "inspection",
        search: "system",
      })
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          action: "inspection.created",
          actor: {
            email: "admin@example.com",
            id: "user-1",
            name: "System Admin",
            role: "admin",
          },
          createdAt: createdAt.toISOString(),
          detail: "Assigned to inspector inspector-1",
          entityId: "inspection-1",
          entityType: "inspection",
          id: "audit-1",
          summary: "Scheduled inspection for Acme Foods",
        },
      ],
      meta: {
        limit: 20,
        page: 1,
        total: 1,
      },
    });
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { action: "inspection.created" },
            { entityType: "inspection" },
            {
              OR: [
                {
                  actor: {
                    email: {
                      contains: "system",
                      mode: "insensitive",
                    },
                  },
                },
                {
                  actor: {
                    name: {
                      contains: "system",
                      mode: "insensitive",
                    },
                  },
                },
                {
                  detail: {
                    contains: "system",
                    mode: "insensitive",
                  },
                },
                {
                  entityId: {
                    contains: "system",
                    mode: "insensitive",
                  },
                },
                {
                  summary: {
                    contains: "system",
                    mode: "insensitive",
                  },
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it("rejects inspector access to audit log entries", async () => {
    const response = await request(app)
      .get("/api/v1/audit-logs")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});