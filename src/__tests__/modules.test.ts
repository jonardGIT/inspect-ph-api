import request from "supertest";

const mockModuleCount = jest.fn();
const mockModuleCreate = jest.fn();
const mockModuleFindMany = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    module: {
      count: mockModuleCount,
      create: mockModuleCreate,
      findMany: mockModuleFindMany,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Module routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists modules for authenticated inspectors", async () => {
    const createdAt = new Date("2026-05-14T08:00:00.000Z");

    mockModuleCount.mockResolvedValue(1);
    mockModuleFindMany.mockResolvedValue([
      {
        code: "BPLO",
        createdAt,
        description: "Business permit and licensing operations",
        id: "11111111-1111-4111-8111-111111111111",
        isActive: true,
        name: "BPLO Inspection",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/modules?page=1&limit=10&isActive=true")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({
      code: "BPLO",
      createdAt: createdAt.toISOString(),
      description: "Business permit and licensing operations",
      id: "11111111-1111-4111-8111-111111111111",
      isActive: true,
      name: "BPLO Inspection",
      updatedAt: createdAt.toISOString(),
    });
  });

  it("creates a module for admins", async () => {
    const createdAt = new Date("2026-05-14T08:00:00.000Z");

    mockModuleCreate.mockResolvedValue({
      code: "BPLO",
      createdAt,
      description: "Business permit and licensing operations",
      id: "11111111-1111-4111-8111-111111111111",
      isActive: true,
      name: "BPLO Inspection",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/modules")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({
        code: "BPLO",
        description: "Business permit and licensing operations",
        isActive: true,
        name: "BPLO Inspection",
      });

    expect(response.status).toBe(201);
    expect(mockModuleCreate).toHaveBeenCalledWith({
      data: {
        code: "BPLO",
        description: "Business permit and licensing operations",
        isActive: true,
        name: "BPLO Inspection",
      },
    });
  });
});
