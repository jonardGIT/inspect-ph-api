import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

interface MockNotificationOutboxRecord {
  body: string;
  channel: "IN_APP";
  createdAt: Date;
  entityId: string | null;
  entityType: string | null;
  eventType: string;
  id: string;
  recipient: {
    email: string;
    id: string;
    name: string;
    role: "ADMIN" | "INSPECTOR";
  };
  status: "PENDING" | "PROCESSED" | "FAILED";
  title: string;
}

const mockNotificationOutboxCount = jest.fn<() => Promise<number>>();
const mockNotificationOutboxFindMany =
  jest.fn<(...args: unknown[]) => Promise<MockNotificationOutboxRecord[]>>();
const mockNotificationOutboxFindUnique =
  jest.fn<
    (...args: unknown[]) => Promise<MockNotificationOutboxRecord | null>
  >();
const mockNotificationOutboxUpdate =
  jest.fn<(...args: unknown[]) => Promise<MockNotificationOutboxRecord>>();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    notificationOutbox: {
      count: mockNotificationOutboxCount,
      findMany: mockNotificationOutboxFindMany,
      findUnique: mockNotificationOutboxFindUnique,
      update: mockNotificationOutboxUpdate,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Notification outbox routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists queued notification entries for authenticated admins", async () => {
    const createdAt = new Date("2026-05-13T12:00:00.000Z");

    mockNotificationOutboxCount.mockResolvedValue(1);
    mockNotificationOutboxFindMany.mockResolvedValue([
      {
        body: "North Star Trading is now completed.",
        channel: "IN_APP",
        createdAt,
        entityId: "inspection-1",
        entityType: "inspection",
        eventType: "inspection.status_updated",
        id: "notification-1",
        recipient: {
          email: "admin@example.com",
          id: "user-1",
          name: "System Admin",
          role: "ADMIN",
        },
        status: "PENDING",
        title: "Inspection status updated: North Star Trading",
      },
    ]);

    const response = await request(app)
      .get("/api/v1/notifications/outbox")
      .query({ eventType: "inspection.status_updated", search: "completed" })
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          body: "North Star Trading is now completed.",
          channel: "in_app",
          createdAt: createdAt.toISOString(),
          entityId: "inspection-1",
          entityType: "inspection",
          eventType: "inspection.status_updated",
          id: "notification-1",
          recipient: {
            email: "admin@example.com",
            id: "user-1",
            name: "System Admin",
            role: "admin",
          },
          status: "pending",
          title: "Inspection status updated: North Star Trading",
        },
      ],
      meta: {
        limit: 20,
        page: 1,
        total: 1,
      },
    });
  });

  it("rejects inspector access to the notification outbox", async () => {
    const response = await request(app)
      .get("/api/v1/notifications/outbox")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("updates a notification outbox status for authenticated admins", async () => {
    const createdAt = new Date("2026-05-13T12:00:00.000Z");

    mockNotificationOutboxFindUnique.mockResolvedValue({
      body: "North Star Trading is now completed.",
      channel: "IN_APP",
      createdAt,
      entityId: "11111111-1111-4111-8111-111111111111",
      entityType: "inspection",
      eventType: "inspection.status_updated",
      id: "22222222-2222-4222-8222-222222222222",
      recipient: {
        email: "admin@example.com",
        id: "user-1",
        name: "System Admin",
        role: "ADMIN",
      },
      status: "PENDING",
      title: "Inspection status updated: North Star Trading",
    });
    mockNotificationOutboxUpdate.mockResolvedValue({
      body: "North Star Trading is now completed.",
      channel: "IN_APP",
      createdAt,
      entityId: "11111111-1111-4111-8111-111111111111",
      entityType: "inspection",
      eventType: "inspection.status_updated",
      id: "22222222-2222-4222-8222-222222222222",
      recipient: {
        email: "admin@example.com",
        id: "user-1",
        name: "System Admin",
        role: "ADMIN",
      },
      status: "PROCESSED",
      title: "Inspection status updated: North Star Trading",
    });

    const response = await request(app)
      .patch(
        "/api/v1/notifications/outbox/22222222-2222-4222-8222-222222222222/status",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({ status: "processed" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("processed");
    expect(mockNotificationOutboxUpdate).toHaveBeenCalledWith({
      where: { id: "22222222-2222-4222-8222-222222222222" },
      data: { status: "PROCESSED" },
      include: {
        recipient: {
          select: {
            email: true,
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
  });

  it("rejects invalid notification status updates", async () => {
    const response = await request(app)
      .patch(
        "/api/v1/notifications/outbox/22222222-2222-4222-8222-222222222222/status",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({ status: "delivered" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
