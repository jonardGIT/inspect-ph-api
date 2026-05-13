import request from "supertest";

const mockBusinessCount = jest.fn();
const mockBusinessCreate = jest.fn();
const mockBusinessFindMany = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    businessEstablishment: {
      count: mockBusinessCount,
      create: mockBusinessCreate,
      findMany: mockBusinessFindMany,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Business routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists businesses for authenticated inspectors", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockBusinessCount.mockResolvedValue(1);
    mockBusinessFindMany.mockResolvedValue([
      {
        addressLine: "Rizal Street",
        barangay: "Centro 1",
        businessName: "North Star Trading",
        city: "Tuguegarao City",
        contactNumber: "09171234567",
        createdAt,
        id: "11111111-1111-1111-1111-111111111111",
        ownerName: "Maria Santos",
        province: "Cagayan",
        taxIdentificationNumber: "123-456-789",
        tradeName: "North Star",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/businesses?page=1&limit=10")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 10, page: 1, total: 1 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual({
      addressLine: "Rizal Street",
      barangay: "Centro 1",
      businessName: "North Star Trading",
      city: "Tuguegarao City",
      contactNumber: "09171234567",
      createdAt: createdAt.toISOString(),
      id: "11111111-1111-1111-1111-111111111111",
      ownerName: "Maria Santos",
      province: "Cagayan",
      taxIdentificationNumber: "123-456-789",
      tradeName: "North Star",
      updatedAt: createdAt.toISOString(),
    });
  });

  it("creates a business for admins", async () => {
    const createdAt = new Date("2026-05-12T08:00:00.000Z");

    mockBusinessCreate.mockResolvedValue({
      addressLine: "Rizal Street",
      barangay: "Centro 1",
      businessName: "North Star Trading",
      city: "Tuguegarao City",
      contactNumber: "09171234567",
      createdAt,
      id: "11111111-1111-1111-1111-111111111111",
      ownerName: "Maria Santos",
      province: "Cagayan",
      taxIdentificationNumber: "123-456-789",
      tradeName: "North Star",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/businesses")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({
        addressLine: "Rizal Street",
        barangay: "Centro 1",
        businessName: "North Star Trading",
        city: "Tuguegarao City",
        contactNumber: "09171234567",
        ownerName: "Maria Santos",
        province: "Cagayan",
        taxIdentificationNumber: "123-456-789",
        tradeName: "North Star",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.businessName).toBe("North Star Trading");
    expect(mockBusinessCreate).toHaveBeenCalledWith({
      data: {
        addressLine: "Rizal Street",
        barangay: "Centro 1",
        businessName: "North Star Trading",
        city: "Tuguegarao City",
        contactNumber: "09171234567",
        ownerName: "Maria Santos",
        province: "Cagayan",
        taxIdentificationNumber: "123-456-789",
        tradeName: "North Star",
      },
    });
  });

  it("forbids inspectors from creating businesses", async () => {
    const response = await request(app)
      .post("/api/v1/businesses")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      )
      .send({
        addressLine: "Rizal Street",
        barangay: "Centro 1",
        businessName: "North Star Trading",
        city: "Tuguegarao City",
        ownerName: "Maria Santos",
        province: "Cagayan",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
