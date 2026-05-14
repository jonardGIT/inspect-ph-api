import request from "supertest";

const mockOfficeCount = jest.fn();
const mockOfficeCreate = jest.fn();
const mockOfficeFindMany = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    office: {
      count: mockOfficeCount,
      create: mockOfficeCreate,
      findMany: mockOfficeFindMany,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Office routes", () => {
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

  it("lists offices for authenticated inspectors", async () => {
    const createdAt = new Date("2026-05-13T08:00:00.000Z");

    mockOfficeCount.mockResolvedValue(1);
    mockOfficeFindMany.mockResolvedValue([
      {
        code: "BPLO-HQ",
        createdAt,
        description: "Primary permit and inspection office",
        id: "22222222-2222-4222-8222-222222222222",
        lguId: "11111111-1111-4111-8111-111111111111",
        name: "BPLO Headquarters",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get(
        "/api/v1/offices?page=1&limit=10&lguId=11111111-1111-4111-8111-111111111111",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 10, page: 1, total: 1 });
    expect(response.body.data).toEqual([
      {
        code: "BPLO-HQ",
        createdAt: createdAt.toISOString(),
        description: "Primary permit and inspection office",
        id: "22222222-2222-4222-8222-222222222222",
        lguId: "11111111-1111-4111-8111-111111111111",
        name: "BPLO Headquarters",
        updatedAt: createdAt.toISOString(),
      },
    ]);
    expect(mockOfficeCount).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            id: {
              in: ["22222222-2222-4222-8222-222222222222"],
            },
          },
          {
            lguId: "11111111-1111-4111-8111-111111111111",
          },
        ],
      },
    });
    expect(mockOfficeFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 10,
      where: {
        AND: [
          {
            id: {
              in: ["22222222-2222-4222-8222-222222222222"],
            },
          },
          {
            lguId: "11111111-1111-4111-8111-111111111111",
          },
        ],
      },
    });
  });

  it("creates an office for admins", async () => {
    const createdAt = new Date("2026-05-13T08:00:00.000Z");

    mockOfficeCreate.mockResolvedValue({
      code: "BPLO-HQ",
      createdAt,
      description: "Primary permit and inspection office",
      id: "22222222-2222-4222-8222-222222222222",
      lguId: "11111111-1111-4111-8111-111111111111",
      name: "BPLO Headquarters",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/offices")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({
        code: "BPLO-HQ",
        description: "Primary permit and inspection office",
        lguId: "11111111-1111-4111-8111-111111111111",
        name: "BPLO Headquarters",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("BPLO Headquarters");
    expect(mockOfficeCreate).toHaveBeenCalledWith({
      data: {
        code: "BPLO-HQ",
        description: "Primary permit and inspection office",
        lguId: "11111111-1111-4111-8111-111111111111",
        name: "BPLO Headquarters",
      },
    });
  });

  it("forbids inspectors from creating offices", async () => {
    const response = await request(app)
      .post("/api/v1/offices")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      )
      .send({
        code: "BPLO-HQ",
        lguId: "11111111-1111-4111-8111-111111111111",
        name: "BPLO Headquarters",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
