import request from "supertest";

const mockBusinessFindUnique = jest.fn();
const mockPermitCount = jest.fn();
const mockPermitCreate = jest.fn();
const mockPermitFindMany = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    businessEstablishment: {
      findUnique: mockBusinessFindUnique,
    },
    permitRecord: {
      count: mockPermitCount,
      create: mockPermitCreate,
      findMany: mockPermitFindMany,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Permit routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      permitNumber: "BPLO-2026-0001",
      status: "pending_inspection",
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
