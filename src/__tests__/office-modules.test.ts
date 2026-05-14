import request from "supertest";

const mockModuleFindUnique = jest.fn();
const mockOfficeFindUnique = jest.fn();
const mockOfficeModuleCount = jest.fn();
const mockOfficeModuleDelete = jest.fn();
const mockOfficeModuleFindMany = jest.fn();
const mockOfficeModuleFindUnique = jest.fn();
const mockOfficeModuleUpsert = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    module: {
      findUnique: mockModuleFindUnique,
    },
    office: {
      findUnique: mockOfficeFindUnique,
    },
    officeModule: {
      count: mockOfficeModuleCount,
      delete: mockOfficeModuleDelete,
      findMany: mockOfficeModuleFindMany,
      findUnique: mockOfficeModuleFindUnique,
      upsert: mockOfficeModuleUpsert,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Office module routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists office modules for authenticated inspectors", async () => {
    const createdAt = new Date("2026-05-14T08:00:00.000Z");

    mockOfficeModuleCount.mockResolvedValue(1);
    mockOfficeModuleFindMany.mockResolvedValue([
      {
        createdAt,
        id: "assignment-1",
        module: {
          code: "BPLO",
          createdAt,
          description: null,
          id: "module-1",
          isActive: true,
          name: "BPLO Inspection",
          updatedAt: createdAt,
        },
        moduleId: "module-1",
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
      },
    ]);

    const response = await request(app)
      .get(
        "/api/v1/office-modules?page=1&limit=10&officeId=11111111-1111-4111-8111-111111111111",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({
      createdAt: createdAt.toISOString(),
      id: "assignment-1",
      module: {
        code: "BPLO",
        id: "module-1",
        isActive: true,
        name: "BPLO Inspection",
      },
      office: {
        code: "BPLO-HQ",
        id: "office-1",
        lguId: "lgu-1",
        name: "BPLO Headquarters",
      },
    });
  });

  it("creates an office module assignment for admins", async () => {
    const createdAt = new Date("2026-05-14T08:00:00.000Z");

    mockModuleFindUnique.mockResolvedValue({
      code: "BPLO",
      createdAt,
      description: null,
      id: "module-1",
      isActive: true,
      name: "BPLO Inspection",
      updatedAt: createdAt,
    });
    mockOfficeFindUnique.mockResolvedValue({
      code: "BPLO-HQ",
      createdAt,
      description: null,
      id: "office-1",
      lguId: "lgu-1",
      name: "BPLO Headquarters",
      updatedAt: createdAt,
    });
    mockOfficeModuleUpsert.mockResolvedValue({
      createdAt,
      id: "assignment-1",
      module: {
        code: "BPLO",
        createdAt,
        description: null,
        id: "module-1",
        isActive: true,
        name: "BPLO Inspection",
        updatedAt: createdAt,
      },
      moduleId: "module-1",
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
    });

    const response = await request(app)
      .post("/api/v1/office-modules")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({
        moduleId: "22222222-2222-4222-8222-222222222222",
        officeId: "11111111-1111-4111-8111-111111111111",
      });

    expect(response.status).toBe(201);
    expect(mockOfficeModuleUpsert).toHaveBeenCalled();
  });

  it("deletes an office module assignment for admins", async () => {
    mockOfficeModuleFindUnique.mockResolvedValue({ id: "assignment-1" });
    mockOfficeModuleDelete.mockResolvedValue(undefined);

    const response = await request(app)
      .delete("/api/v1/office-modules/11111111-1111-4111-8111-111111111111")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      );

    expect(response.status).toBe(204);
  });
});
