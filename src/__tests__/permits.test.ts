import request from "supertest";

const mockBusinessFindUnique = jest.fn();
const mockPermitCount = jest.fn();
const mockPermitCreate = jest.fn();
const mockPermitFindMany = jest.fn();
const mockPermitFindUnique = jest.fn();
const mockInspectionFindFirst = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    businessEstablishment: {
      findUnique: mockBusinessFindUnique,
    },
    permitRecord: {
      count: mockPermitCount,
      create: mockPermitCreate,
      findMany: mockPermitFindMany,
      findUnique: mockPermitFindUnique,
    },
    inspection: {
      findFirst: mockInspectionFindFirst,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Permit routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({
      lguId: "11111111-1111-4111-8111-111111111111",
      officeAssignments: [
        {
          office: {
            id: "22222222-2222-4222-8222-222222222222",
            lguId: "11111111-1111-4111-8111-111111111111",
          },
        },
      ],
    });
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists permits for authenticated inspectors", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockPermitCount.mockResolvedValue(1);
    mockPermitFindMany.mockResolvedValue([
      {
        applicationDate: createdAt,
        business: {
          businessName: "North Star Trading",
          id: "11111111-1111-4111-8111-111111111111",
        },
        createdAt,
        createdById: "user-1",
        expirationDate: new Date("2027-05-12T08:00:00.000Z"),
        id: "22222222-2222-4222-8222-222222222222",
        lineOfBusiness: "Retail",
        payments: [
          {
            createdAt,
            id: "payment-1",
            receiptNumber: "OR-20260512-ABCD1234",
            referenceNumber: "PAY-20260512-ABCD1234",
            status: "PAID",
            updatedAt: createdAt,
          },
        ],
        permitNumber: "BPLO-2026-0001",
        status: "PENDING_INSPECTION",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/permits?page=1&limit=5")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 5, page: 1, total: 1 });
    expect(response.body.data[0]).toEqual({
      applicationDate: createdAt.toISOString(),
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      createdAt: createdAt.toISOString(),
      createdById: "user-1",
      expirationDate: "2027-05-12T08:00:00.000Z",
      id: "22222222-2222-4222-8222-222222222222",
      lineOfBusiness: "Retail",
      latestPayment: {
        id: "payment-1",
        receiptNumber: "OR-20260512-ABCD1234",
        referenceNumber: "PAY-20260512-ABCD1234",
        status: "paid",
        updatedAt: createdAt.toISOString(),
      },
      permitNumber: "BPLO-2026-0001",
      status: "pending_inspection",
      updatedAt: createdAt.toISOString(),
    });
    expect(mockPermitCount).toHaveBeenCalledWith({
      where: {
        inspections: {
          some: {
            officeId: {
              in: ["22222222-2222-4222-8222-222222222222"],
            },
          },
        },
      },
    });
    expect(mockPermitFindMany).toHaveBeenCalledWith({
      include: {
        business: {
          select: {
            businessName: true,
            id: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 5,
      where: {
        inspections: {
          some: {
            officeId: {
              in: ["22222222-2222-4222-8222-222222222222"],
            },
          },
        },
      },
    });
  });

  it("looks up a permit publicly by permit number", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockPermitFindUnique.mockResolvedValue({
      applicationDate: createdAt,
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      createdAt,
      createdById: "user-1",
      expirationDate: new Date("2027-05-12T08:00:00.000Z"),
      id: "22222222-2222-4222-8222-222222222222",
      lineOfBusiness: "Retail",
      permitNumber: "BPLO-2026-0001",
      status: "PENDING_INSPECTION",
      updatedAt: createdAt,
    });

    const response = await request(app).get(
      "/api/v1/permits/public/BPLO-2026-0001",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      applicationDate: createdAt.toISOString(),
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      createdAt: createdAt.toISOString(),
      expirationDate: "2027-05-12T08:00:00.000Z",
      lineOfBusiness: "Retail",
      permitNumber: "BPLO-2026-0001",
      status: "pending_inspection",
      updatedAt: createdAt.toISOString(),
    });
  });

  it("looks up public permit findings by permit number", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");
    const dueDate = new Date("2026-05-19T08:00:00.000Z");

    mockPermitFindUnique.mockResolvedValue({
      applicationDate: createdAt,
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      createdAt,
      createdById: "user-1",
      expirationDate: new Date("2027-05-12T08:00:00.000Z"),
      id: "22222222-2222-4222-8222-222222222222",
      lineOfBusiness: "Retail",
      permitNumber: "BPLO-2026-0001",
      status: "PENDING_INSPECTION",
      updatedAt: createdAt,
    });
    mockInspectionFindFirst.mockResolvedValue({
      completedAt: null,
      createdAt,
      findings: [
        {
          checklistResultId: null,
          correctiveAction: "Replace damaged signage",
          createdAt,
          description: "Main signboard is damaged",
          dueDate,
          id: "finding-1",
          inspectionId: "inspection-1",
          locationAccuracyMeters: null,
          locationLatitude: null,
          locationLongitude: null,
          resolvedAt: null,
          severity: "HIGH",
          title: "Damaged Signage",
          updatedAt: createdAt,
        },
      ],
      id: "inspection-1",
      scheduledAt: createdAt,
      status: "IN_PROGRESS",
    });

    const response = await request(app).get(
      "/api/v1/permits/public/BPLO-2026-0001/findings",
    );

    expect(response.status).toBe(200);
    expect(response.body.data.permit.permitNumber).toBe("BPLO-2026-0001");
    expect(response.body.data.latestInspection).toEqual({
      completedAt: undefined,
      id: "inspection-1",
      scheduledAt: createdAt.toISOString(),
      status: "in_progress",
    });
    expect(response.body.data.findings[0]).toEqual({
      checklistResultId: undefined,
      correctiveAction: "Replace damaged signage",
      createdAt: createdAt.toISOString(),
      description: "Main signboard is damaged",
      dueDate: dueDate.toISOString(),
      id: "finding-1",
      inspectionId: "inspection-1",
      location: undefined,
      resolvedAt: undefined,
      severity: "high",
      title: "Damaged Signage",
      updatedAt: createdAt.toISOString(),
    });
  });

  it("creates a permit for admins", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockBusinessFindUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
    });
    mockPermitCreate.mockResolvedValue({
      applicationDate: createdAt,
      business: {
        businessName: "North Star Trading",
        id: "11111111-1111-4111-8111-111111111111",
      },
      createdAt,
      createdById: "user-1",
      expirationDate: new Date("2027-05-12T08:00:00.000Z"),
      id: "22222222-2222-4222-8222-222222222222",
      lineOfBusiness: "Retail",
      permitNumber: "BPLO-2026-0001",
      status: "PENDING_INSPECTION",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/permits")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({
        applicationDate: "2026-05-12T08:00:00.000Z",
        businessId: "11111111-1111-4111-8111-111111111111",
        expirationDate: "2027-05-12T08:00:00.000Z",
        lineOfBusiness: "Retail",
        permitNumber: "BPLO-2026-0001",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.permitNumber).toBe("BPLO-2026-0001");
    expect(mockPermitCreate).toHaveBeenCalledWith({
      data: {
        applicationDate: new Date("2026-05-12T08:00:00.000Z"),
        businessId: "11111111-1111-4111-8111-111111111111",
        createdById: "user-1",
        expirationDate: new Date("2027-05-12T08:00:00.000Z"),
        lineOfBusiness: "Retail",
        permitNumber: "BPLO-2026-0001",
      },
      include: {
        business: {
          select: {
            businessName: true,
            id: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  });

  it("returns not found when creating a permit for an unknown business", async () => {
    mockBusinessFindUnique.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/v1/permits")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({
        applicationDate: "2026-05-12T08:00:00.000Z",
        businessId: "11111111-1111-4111-8111-111111111111",
        expirationDate: "2027-05-12T08:00:00.000Z",
        lineOfBusiness: "Retail",
        permitNumber: "BPLO-2026-0001",
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("BUSINESS_NOT_FOUND");
  });
});
