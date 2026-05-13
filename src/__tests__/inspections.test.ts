import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

function createMock<TReturn>() {
  return jest.fn<(...args: unknown[]) => TReturn>();
}

const mockAuditLogCreate = createMock<Promise<void>>();
const mockNotificationOutboxCount = createMock<Promise<number>>();
const mockNotificationOutboxCreateMany =
  createMock<Promise<{ count: number }>>();
const mockNotificationOutboxFindMany = createMock<Promise<unknown[]>>();
const mockBusinessFindUnique = createMock<Promise<unknown>>();
const mockAttachmentCreate = createMock<Promise<unknown>>();
const mockAttachmentFindMany = createMock<Promise<unknown[]>>();
const mockAttachmentFindUnique = createMock<Promise<unknown>>();
const mockCreateDownloadIntent = createMock<Promise<unknown>>();
const mockCreateUploadIntent = createMock<Promise<unknown>>();
const mockInspectionCount = createMock<Promise<number>>();
const mockInspectionCreate = createMock<Promise<unknown>>();
const mockInspectionFindFirst = createMock<Promise<unknown>>();
const mockInspectionFindMany = createMock<Promise<unknown[]>>();
const mockInspectionFindUnique = createMock<Promise<unknown>>();
const mockInspectionUpdate = createMock<Promise<unknown>>();
const mockChecklistResultFindMany = createMock<Promise<unknown[]>>();
const mockChecklistResultFindUnique = createMock<Promise<unknown>>();
const mockChecklistResultUpsert = createMock<Promise<unknown>>();
const mockChecklistTemplateFindMany = createMock<Promise<unknown[]>>();
const mockChecklistTemplateFindUnique = createMock<Promise<unknown>>();
const mockFindingCreate = createMock<Promise<unknown>>();
const mockFindingFindFirst = createMock<Promise<unknown>>();
const mockFindingFindMany = createMock<Promise<unknown[]>>();
const mockFindingFindUnique = createMock<Promise<unknown>>();
const mockFindingUpdate = createMock<Promise<unknown>>();
const mockPermitFindUnique = createMock<Promise<unknown>>();
const mockUserFindFirst = createMock<Promise<unknown>>();
const mockUserFindMany = createMock<Promise<unknown[]>>();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
    },
    notificationOutbox: {
      count: mockNotificationOutboxCount,
      createMany: mockNotificationOutboxCreateMany,
      findMany: mockNotificationOutboxFindMany,
    },
    attachment: {
      create: mockAttachmentCreate,
      findMany: mockAttachmentFindMany,
      findUnique: mockAttachmentFindUnique,
    },
    businessEstablishment: {
      findUnique: mockBusinessFindUnique,
    },
    checklistTemplate: {
      findMany: mockChecklistTemplateFindMany,
      findUnique: mockChecklistTemplateFindUnique,
    },
    finding: {
      create: mockFindingCreate,
      findFirst: mockFindingFindFirst,
      findMany: mockFindingFindMany,
      findUnique: mockFindingFindUnique,
      update: mockFindingUpdate,
    },
    inspection: {
      count: mockInspectionCount,
      create: mockInspectionCreate,
      findFirst: mockInspectionFindFirst,
      findMany: mockInspectionFindMany,
      findUnique: mockInspectionFindUnique,
      update: mockInspectionUpdate,
    },
    inspectionChecklistResult: {
      findMany: mockChecklistResultFindMany,
      findUnique: mockChecklistResultFindUnique,
      upsert: mockChecklistResultUpsert,
    },
    permitRecord: {
      findUnique: mockPermitFindUnique,
    },
    user: {
      findFirst: mockUserFindFirst,
      findMany: mockUserFindMany,
    },
  },
}));

jest.mock("../lib/storage-provider.js", () => ({
  getAttachmentStorageProvider: () => ({
    createDownloadIntent: mockCreateDownloadIntent,
    createUploadIntent: mockCreateUploadIntent,
  }),
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Inspection routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue(undefined);
    mockNotificationOutboxCreateMany.mockResolvedValue({ count: 1 });
    mockUserFindMany.mockResolvedValue([]);
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists inspections for authenticated inspectors using assigned scope", async () => {
    const scheduledAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionCount.mockResolvedValue(1);
    mockInspectionFindMany.mockResolvedValue([
      {
        business: {
          businessName: "North Star Trading",
          id: "11111111-1111-4111-8111-111111111111",
        },
        completedAt: null,
        createdAt: scheduledAt,
        id: "33333333-3333-4333-8333-333333333333",
        inspectorId: "22222222-2222-4222-8222-222222222222",
        notes: "Initial BPLO visit",
        permitRecord: {
          id: "44444444-4444-4444-8444-444444444444",
          permitNumber: "BPLO-2026-0001",
        },
        scheduledAt,
        startedAt: null,
        status: "SCHEDULED",
        updatedAt: scheduledAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/inspections?page=1&limit=5")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 5, page: 1, total: 1 });
    expect(response.body.data[0]).toEqual({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      createdAt: scheduledAt.toISOString(),
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: "Initial BPLO visit",
      permit: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: scheduledAt.toISOString(),
      status: "scheduled",
      updatedAt: scheduledAt.toISOString(),
    });
    expect(mockInspectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inspectorId: "22222222-2222-4222-8222-222222222222" },
      }),
    );
  });

  it("returns an inspection detail for the assigned inspector", async () => {
    const scheduledAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt: scheduledAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt,
      startedAt: null,
      status: "SCHEDULED",
      updatedAt: scheduledAt,
    });

    const response = await request(app)
      .get("/api/v1/inspections/33333333-3333-4333-8333-333333333333")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("33333333-3333-4333-8333-333333333333");
    expect(mockInspectionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "33333333-3333-4333-8333-333333333333",
          inspectorId: "22222222-2222-4222-8222-222222222222",
        },
      }),
    );
  });

  it("returns dedicated history events for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");
    const startedAt = new Date("2026-05-12T08:15:00.000Z");
    const attachmentCreatedAt = new Date("2026-05-12T08:45:00.000Z");
    const checklistUpdatedAt = new Date("2026-05-12T08:30:00.000Z");
    const findingCreatedAt = new Date("2026-05-12T08:40:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt,
      status: "IN_PROGRESS",
      updatedAt: attachmentCreatedAt,
    });
    mockChecklistResultFindMany.mockResolvedValue([
      {
        createdAt,
        id: "check-1",
        inspectionId: "33333333-3333-4333-8333-333333333333",
        remarks: "Compliant",
        status: "PASS",
        template: {
          code: "F001",
          title: "Fire exit",
        },
        updatedAt: checklistUpdatedAt,
      },
    ]);
    mockFindingFindMany.mockResolvedValue([
      {
        checklistResultId: null,
        correctiveAction: null,
        createdAt: findingCreatedAt,
        description: "Blocked egress near the kitchen",
        dueDate: null,
        id: "finding-1",
        inspectionId: "33333333-3333-4333-8333-333333333333",
        locationAccuracyMeters: null,
        locationLatitude: null,
        locationLongitude: null,
        resolvedAt: null,
        severity: "HIGH",
        title: "Blocked exit",
        updatedAt: findingCreatedAt,
      },
    ]);
    mockAttachmentFindMany.mockResolvedValue([
      {
        capturedAt: null,
        createdAt: attachmentCreatedAt,
        fileName: "frontage.jpg",
        fileSizeBytes: 245760,
        findingId: null,
        id: "attachment-1",
        inspectionId: "33333333-3333-4333-8333-333333333333",
        locationAccuracyMeters: null,
        locationLatitude: null,
        locationLongitude: null,
        mimeType: "image/jpeg",
        storageKey: "bplo/2026/frontage.jpg",
        updatedAt: attachmentCreatedAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/inspections/33333333-3333-4333-8333-333333333333/history")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        detail: "image/jpeg",
        entityId: "attachment-1",
        occurredAt: attachmentCreatedAt.toISOString(),
        title: "Attachment stored: frontage.jpg",
        type: "attachment_uploaded",
      },
      {
        detail: "Blocked egress near the kitchen",
        entityId: "finding-1",
        occurredAt: findingCreatedAt.toISOString(),
        title: "Finding logged: Blocked exit",
        type: "finding_logged",
      },
      {
        detail: "Compliant",
        entityId: "check-1",
        occurredAt: checklistUpdatedAt.toISOString(),
        title: "Checklist F001 recorded as pass",
        type: "checklist_result_recorded",
      },
      {
        entityId: "33333333-3333-4333-8333-333333333333",
        occurredAt: startedAt.toISOString(),
        title: "Inspection started in the field",
        type: "inspection_started",
      },
      {
        entityId: "33333333-3333-4333-8333-333333333333",
        occurredAt: createdAt.toISOString(),
        title: "Inspection record created for North Star Trading",
        type: "inspection_created",
      },
    ]);
  });

  it("creates an inspection for admins", async () => {
    const scheduledAt = new Date("2026-05-12T08:00:00.000Z");

    mockBusinessFindUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
    });
    mockPermitFindUnique.mockResolvedValue({
      businessId: "11111111-1111-4111-8111-111111111111",
      id: "44444444-4444-4444-8444-444444444444",
    });
    mockUserFindFirst.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
    });
    mockInspectionCreate.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt: scheduledAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      locationAccuracyMeters: 6,
      locationLatitude: 17.6132,
      locationLongitude: 121.727,
      notes: "Initial BPLO visit",
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt,
      startedAt: null,
      status: "SCHEDULED",
      updatedAt: scheduledAt,
    });

    const response = await request(app)
      .post("/api/v1/inspections")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })}`,
      )
      .send({
        accuracyMeters: 6,
        businessId: "11111111-1111-4111-8111-111111111111",
        inspectorId: "22222222-2222-4222-8222-222222222222",
        latitude: 17.6132,
        longitude: 121.727,
        notes: "Initial BPLO visit",
        permitRecordId: "44444444-4444-4444-8444-444444444444",
        scheduledAt: "2026-05-12T08:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.location).toEqual({
      accuracyMeters: 6,
      latitude: 17.6132,
      longitude: 121.727,
    });
    expect(response.body.data.status).toBe("scheduled");
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "inspection.created",
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        entityId: "33333333-3333-4333-8333-333333333333",
        entityType: "inspection",
      }),
    });
    expect(mockNotificationOutboxCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          entityId: "33333333-3333-4333-8333-333333333333",
          entityType: "inspection",
          eventType: "inspection.assigned",
          recipientUserId: "22222222-2222-4222-8222-222222222222",
        }),
      ],
    });
    expect(mockInspectionCreate).toHaveBeenCalledWith({
      data: {
        businessId: "11111111-1111-4111-8111-111111111111",
        inspectorId: "22222222-2222-4222-8222-222222222222",
        locationAccuracyMeters: 6,
        locationLatitude: 17.6132,
        locationLongitude: 121.727,
        notes: "Initial BPLO visit",
        permitRecordId: "44444444-4444-4444-8444-444444444444",
        scheduledAt: new Date("2026-05-12T08:00:00.000Z"),
      },
      include: {
        business: {
          select: {
            businessName: true,
            id: true,
          },
        },
        permitRecord: {
          select: {
            id: true,
            permitNumber: true,
          },
        },
      },
    });
  });

  it("assigns an inspection for admins", async () => {
    const scheduledAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
    });
    mockUserFindFirst.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
    });
    mockInspectionUpdate.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt: scheduledAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt,
      startedAt: null,
      status: "SCHEDULED",
      updatedAt: scheduledAt,
    });

    const response = await request(app)
      .patch(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/assignment",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })}`,
      )
      .send({
        inspectorId: "22222222-2222-4222-8222-222222222222",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.inspectorId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "inspection.assigned",
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        entityId: "33333333-3333-4333-8333-333333333333",
        entityType: "inspection",
      }),
    });
    expect(mockNotificationOutboxCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          entityId: "33333333-3333-4333-8333-333333333333",
          entityType: "inspection",
          eventType: "inspection.assigned",
          recipientUserId: "22222222-2222-4222-8222-222222222222",
        }),
      ],
    });
  });

  it("updates status for an assigned inspector", async () => {
    const scheduledAt = new Date("2026-05-12T08:00:00.000Z");
    const updatedAt = new Date("2026-05-12T09:00:00.000Z");

    mockUserFindMany.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    ]);

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt: scheduledAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: "Initial BPLO visit",
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt,
      startedAt: null,
      status: "SCHEDULED",
      updatedAt: scheduledAt,
    });
    mockInspectionUpdate.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt: scheduledAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      locationAccuracyMeters: 4,
      locationLatitude: 17.614,
      locationLongitude: 121.728,
      notes: "Inspector on site",
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt,
      startedAt: updatedAt,
      status: "IN_PROGRESS",
      updatedAt,
    });

    const response = await request(app)
      .patch("/api/v1/inspections/33333333-3333-4333-8333-333333333333/status")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      )
      .send({
        accuracyMeters: 4,
        latitude: 17.614,
        longitude: 121.728,
        notes: "Inspector on site",
        status: "IN_PROGRESS",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.location).toEqual({
      accuracyMeters: 4,
      latitude: 17.614,
      longitude: 121.728,
    });
    expect(response.body.data.status).toBe("in_progress");
    expect(mockInspectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationAccuracyMeters: 4,
          locationLatitude: 17.614,
          locationLongitude: 121.728,
          notes: "Inspector on site",
          status: "IN_PROGRESS",
        }),
      }),
    );
    expect(mockNotificationOutboxCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          body: "North Star Trading is now in progress.",
          entityId: "33333333-3333-4333-8333-333333333333",
          entityType: "inspection",
          eventType: "inspection.status_updated",
          recipientUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Inspection status updated: North Star Trading",
        }),
      ],
    });
  });

  it("forbids inspectors from assigning inspections", async () => {
    const response = await request(app)
      .patch(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/assignment",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      )
      .send({ inspectorId: "22222222-2222-4222-8222-222222222222" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects invalid inspection status values", async () => {
    const response = await request(app)
      .patch("/api/v1/inspections/33333333-3333-4333-8333-333333333333/status")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })}`,
      )
      .send({ status: "INVALID_STATUS" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns inspection summary counts for authenticated inspectors", async () => {
    mockInspectionCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const response = await request(app)
      .get("/api/v1/inspections/summary")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      canceled: 0,
      completed: 5,
      inProgress: 2,
      overdue: 1,
      scheduled: 3,
      total: 11,
    });
    expect(mockInspectionCount).toHaveBeenNthCalledWith(1, {
      where: {
        inspectorId: "22222222-2222-4222-8222-222222222222",
        status: "SCHEDULED",
      },
    });
  });

  it("lists active checklist templates", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockChecklistTemplateFindMany.mockResolvedValue([
      {
        code: "BPLO-FACADE",
        createdAt,
        description: "Facade and signage compliance",
        id: "55555555-5555-4555-8555-555555555555",
        isActive: true,
        module: "BPLO",
        sortOrder: 1,
        title: "Facade Check",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/inspections/checklist-templates?module=BPLO")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({
      code: "BPLO-FACADE",
      createdAt: createdAt.toISOString(),
      description: "Facade and signage compliance",
      id: "55555555-5555-4555-8555-555555555555",
      isActive: true,
      module: "BPLO",
      sortOrder: 1,
      title: "Facade Check",
      updatedAt: createdAt.toISOString(),
    });
  });

  it("upserts a checklist result for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt: null,
      status: "IN_PROGRESS",
      updatedAt: createdAt,
    });
    mockChecklistTemplateFindUnique.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      isActive: true,
    });
    mockChecklistResultUpsert.mockResolvedValue({
      createdAt,
      id: "66666666-6666-4666-8666-666666666666",
      inspectionId: "33333333-3333-4333-8333-333333333333",
      remarks: "Compliant facade",
      status: "PASS",
      template: {
        code: "BPLO-FACADE",
        id: "55555555-5555-4555-8555-555555555555",
        module: "BPLO",
        title: "Facade Check",
      },
      updatedAt: createdAt,
    });

    const response = await request(app)
      .put(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/checklist-results/55555555-5555-4555-8555-555555555555",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      )
      .send({ remarks: "Compliant facade", status: "PASS" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("pass");
    expect(mockChecklistResultUpsert).toHaveBeenCalledWith({
      create: {
        inspectionId: "33333333-3333-4333-8333-333333333333",
        remarks: "Compliant facade",
        status: "PASS",
        templateId: "55555555-5555-4555-8555-555555555555",
      },
      include: {
        template: {
          select: {
            code: true,
            id: true,
            module: true,
            title: true,
          },
        },
      },
      update: {
        remarks: "Compliant facade",
        status: "PASS",
      },
      where: {
        inspectionId_templateId: {
          inspectionId: "33333333-3333-4333-8333-333333333333",
          templateId: "55555555-5555-4555-8555-555555555555",
        },
      },
    });
  });

  it("creates a finding for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt: null,
      status: "IN_PROGRESS",
      updatedAt: createdAt,
    });
    mockFindingCreate.mockResolvedValue({
      checklistResultId: undefined,
      correctiveAction: "Replace damaged signage",
      createdAt,
      description: "Main signboard is damaged",
      dueDate: new Date("2026-05-19T08:00:00.000Z"),
      id: "77777777-7777-4777-8777-777777777777",
      inspectionId: "33333333-3333-4333-8333-333333333333",
      locationAccuracyMeters: 5,
      locationLatitude: 17.6125,
      locationLongitude: 121.7265,
      resolvedAt: null,
      severity: "HIGH",
      title: "Damaged Signage",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/inspections/33333333-3333-4333-8333-333333333333/findings")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      )
      .send({
        accuracyMeters: 5,
        correctiveAction: "Replace damaged signage",
        description: "Main signboard is damaged",
        dueDate: "2026-05-19T08:00:00.000Z",
        latitude: 17.6125,
        longitude: 121.7265,
        severity: "HIGH",
        title: "Damaged Signage",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.location).toEqual({
      accuracyMeters: 5,
      latitude: 17.6125,
      longitude: 121.7265,
    });
    expect(response.body.data.severity).toBe("high");
  });

  it("lists inspection attachments for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt: null,
      status: "IN_PROGRESS",
      updatedAt: createdAt,
    });
    mockAttachmentFindMany.mockResolvedValue([
      {
        capturedAt: createdAt,
        createdAt,
        fileName: "frontage.jpg",
        fileSizeBytes: 245760,
        findingId: "77777777-7777-4777-8777-777777777777",
        id: "88888888-8888-4888-8888-888888888888",
        inspectionId: "33333333-3333-4333-8333-333333333333",
        locationAccuracyMeters: 3,
        locationLatitude: 17.6126,
        locationLongitude: 121.7267,
        mimeType: "image/jpeg",
        storageKey: "bplo/2026/frontage.jpg",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/attachments",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({
      capturedAt: createdAt.toISOString(),
      createdAt: createdAt.toISOString(),
      fileName: "frontage.jpg",
      fileSizeBytes: 245760,
      findingId: "77777777-7777-4777-8777-777777777777",
      id: "88888888-8888-4888-8888-888888888888",
      inspectionId: "33333333-3333-4333-8333-333333333333",
      location: {
        accuracyMeters: 3,
        latitude: 17.6126,
        longitude: 121.7267,
      },
      mimeType: "image/jpeg",
      storageKey: "bplo/2026/frontage.jpg",
      updatedAt: createdAt.toISOString(),
    });
  });

  it("creates an attachment upload intent for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt: null,
      status: "IN_PROGRESS",
      updatedAt: createdAt,
    });
    mockCreateUploadIntent.mockResolvedValue({
      provider: "local",
      requiresMetadataCreate: true,
      storageKey: "inspections/33333333/frontage.jpg",
      uploadHeaders: {},
      uploadMethod: "PUT",
      uploadStrategy: "api_binary_upload",
    });

    const response = await request(app)
      .post(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/attachments/upload-intents",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      )
      .send({ fileName: "frontage.jpg" });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      provider: "local",
      requiresMetadataCreate: true,
      storageKey: "inspections/33333333/frontage.jpg",
      uploadHeaders: {},
      uploadMethod: "PUT",
      uploadStrategy: "api_binary_upload",
    });
    expect(mockCreateUploadIntent).toHaveBeenCalledWith({
      fileName: "frontage.jpg",
      inspectionId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("creates an attachment download intent for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt: null,
      status: "IN_PROGRESS",
      updatedAt: createdAt,
    });
    mockAttachmentFindUnique.mockResolvedValue({
      fileName: "frontage.jpg",
      id: "88888888-8888-4888-8888-888888888888",
      inspectionId: "33333333-3333-4333-8333-333333333333",
      mimeType: "image/jpeg",
      storageKey: "inspections/33333333/frontage.jpg",
    });
    mockCreateDownloadIntent.mockResolvedValue({
      downloadMethod: "GET",
      downloadPath: "/api/v1/uploads/local/download-token",
      downloadStrategy: "api_binary_download",
      downloadUrl: "http://localhost:4000/api/v1/uploads/local/download-token",
      expiresInSeconds: 600,
      provider: "local",
    });

    const response = await request(app)
      .get(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/attachments/88888888-8888-4888-8888-888888888888/download-intent",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      downloadMethod: "GET",
      downloadPath: "/api/v1/uploads/local/download-token",
      downloadStrategy: "api_binary_download",
      downloadUrl: "http://localhost:4000/api/v1/uploads/local/download-token",
      expiresInSeconds: 600,
      provider: "local",
    });
    expect(mockCreateDownloadIntent).toHaveBeenCalledWith({
      fileName: "frontage.jpg",
      mimeType: "image/jpeg",
      storageKey: "inspections/33333333/frontage.jpg",
    });
  });

  it("creates attachment metadata for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt: null,
      status: "IN_PROGRESS",
      updatedAt: createdAt,
    });
    mockFindingFindUnique.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      inspectionId: "33333333-3333-4333-8333-333333333333",
    });
    mockAttachmentCreate.mockResolvedValue({
      capturedAt: createdAt,
      createdAt,
      fileName: "frontage.jpg",
      fileSizeBytes: 245760,
      findingId: "77777777-7777-4777-8777-777777777777",
      id: "88888888-8888-4888-8888-888888888888",
      inspectionId: "33333333-3333-4333-8333-333333333333",
      locationAccuracyMeters: 3,
      locationLatitude: 17.6126,
      locationLongitude: 121.7267,
      mimeType: "image/jpeg",
      storageKey: "bplo/2026/frontage.jpg",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/attachments",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      )
      .send({
        accuracyMeters: 3,
        capturedAt: "2026-05-12T08:00:00.000Z",
        fileName: "frontage.jpg",
        fileSizeBytes: 245760,
        findingId: "77777777-7777-4777-8777-777777777777",
        latitude: 17.6126,
        longitude: 121.7267,
        mimeType: "image/jpeg",
        storageKey: "bplo/2026/frontage.jpg",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.fileName).toBe("frontage.jpg");
    expect(response.body.data.location).toEqual({
      accuracyMeters: 3,
      latitude: 17.6126,
      longitude: 121.7267,
    });
    expect(mockAttachmentCreate).toHaveBeenCalledWith({
      data: {
        capturedAt: new Date("2026-05-12T08:00:00.000Z"),
        fileName: "frontage.jpg",
        fileSizeBytes: 245760,
        findingId: "77777777-7777-4777-8777-777777777777",
        inspectionId: "33333333-3333-4333-8333-333333333333",
        locationAccuracyMeters: 3,
        locationLatitude: 17.6126,
        locationLongitude: 121.7267,
        mimeType: "image/jpeg",
        storageKey: "bplo/2026/frontage.jpg",
      },
    });
  });

  it("rejects partial geo input on inspection status updates", async () => {
    const response = await request(app)
      .patch("/api/v1/inspections/33333333-3333-4333-8333-333333333333/status")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      )
      .send({ latitude: 17.614, status: "IN_PROGRESS" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("resolves a finding for an assigned inspection", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");
    const resolvedAt = new Date("2026-05-12T10:00:00.000Z");

    mockInspectionFindFirst.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      completedAt: null,
      createdAt,
      id: "33333333-3333-4333-8333-333333333333",
      inspectorId: "22222222-2222-4222-8222-222222222222",
      notes: null,
      permitRecord: {
        id: "44444444-4444-4444-8444-444444444444",
        permitNumber: "BPLO-2026-0001",
      },
      scheduledAt: createdAt,
      startedAt: null,
      status: "IN_PROGRESS",
      updatedAt: createdAt,
    });
    mockFindingFindFirst.mockResolvedValue({
      checklistResultId: null,
      correctiveAction: null,
      createdAt,
      description: "Main signboard is damaged",
      dueDate: null,
      id: "77777777-7777-4777-8777-777777777777",
      inspectionId: "33333333-3333-4333-8333-333333333333",
      resolvedAt: null,
      severity: "HIGH",
      title: "Damaged Signage",
      updatedAt: createdAt,
    });
    mockFindingUpdate.mockResolvedValue({
      checklistResultId: null,
      correctiveAction: null,
      createdAt,
      description: "Main signboard is damaged",
      dueDate: null,
      id: "77777777-7777-4777-8777-777777777777",
      inspectionId: "33333333-3333-4333-8333-333333333333",
      resolvedAt,
      severity: "HIGH",
      title: "Damaged Signage",
      updatedAt: resolvedAt,
    });

    const response = await request(app)
      .patch(
        "/api/v1/inspections/33333333-3333-4333-8333-333333333333/findings/77777777-7777-4777-8777-777777777777/resolve",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "22222222-2222-4222-8222-222222222222" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data.resolvedAt).toBe(resolvedAt.toISOString());
  });
});
