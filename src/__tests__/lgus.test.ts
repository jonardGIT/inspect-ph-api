import request from "supertest";

const mockLguCount = jest.fn();
const mockLguCreate = jest.fn();
const mockLguFindMany = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    lgu: {
      count: mockLguCount,
      create: mockLguCreate,
      findMany: mockLguFindMany,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("LGU routes", () => {
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

  it("lists LGUs for authenticated inspectors", async () => {
    const createdAt = new Date("2026-05-13T08:00:00.000Z");

    mockLguCount.mockResolvedValue(1);
    mockLguFindMany.mockResolvedValue([
      {
        city: "Tuguegarao City",
        code: "TUG-01",
        createdAt,
        id: "11111111-1111-4111-8111-111111111111",
        name: "Tuguegarao City LGU",
        province: "Cagayan",
        region: "Region II",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/lgus?page=1&limit=10&search=tuguegarao")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 10, page: 1, total: 1 });
    expect(response.body.data).toEqual([
      {
        city: "Tuguegarao City",
        code: "TUG-01",
        createdAt: createdAt.toISOString(),
        id: "11111111-1111-4111-8111-111111111111",
        name: "Tuguegarao City LGU",
        province: "Cagayan",
        region: "Region II",
        updatedAt: createdAt.toISOString(),
      },
    ]);
    expect(mockLguCount).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            id: {
              in: ["11111111-1111-4111-8111-111111111111"],
            },
          },
          {
            OR: [
              { id: { equals: "tuguegarao" } },
              { code: { contains: "tuguegarao", mode: "insensitive" } },
              { name: { contains: "tuguegarao", mode: "insensitive" } },
              { region: { contains: "tuguegarao", mode: "insensitive" } },
              { province: { contains: "tuguegarao", mode: "insensitive" } },
              { city: { contains: "tuguegarao", mode: "insensitive" } },
            ],
          },
        ],
      },
    });
    expect(mockLguFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 10,
      where: {
        AND: [
          {
            id: {
              in: ["11111111-1111-4111-8111-111111111111"],
            },
          },
          {
            OR: [
              { id: { equals: "tuguegarao" } },
              { code: { contains: "tuguegarao", mode: "insensitive" } },
              { name: { contains: "tuguegarao", mode: "insensitive" } },
              { region: { contains: "tuguegarao", mode: "insensitive" } },
              { province: { contains: "tuguegarao", mode: "insensitive" } },
              { city: { contains: "tuguegarao", mode: "insensitive" } },
            ],
          },
        ],
      },
    });
  });

  it("creates an LGU for admins", async () => {
    const createdAt = new Date("2026-05-13T08:00:00.000Z");

    mockLguCreate.mockResolvedValue({
      city: "Tuguegarao City",
      code: "TUG-01",
      createdAt,
      id: "11111111-1111-4111-8111-111111111111",
      name: "Tuguegarao City LGU",
      province: "Cagayan",
      region: "Region II",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/lgus")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "user-1" })}`,
      )
      .send({
        city: "Tuguegarao City",
        code: "TUG-01",
        name: "Tuguegarao City LGU",
        province: "Cagayan",
        region: "Region II",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.code).toBe("TUG-01");
    expect(mockLguCreate).toHaveBeenCalledWith({
      data: {
        city: "Tuguegarao City",
        code: "TUG-01",
        name: "Tuguegarao City LGU",
        province: "Cagayan",
        region: "Region II",
      },
    });
  });

  it("forbids inspectors from creating LGUs", async () => {
    const response = await request(app)
      .post("/api/v1/lgus")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-2" })}`,
      )
      .send({
        code: "TUG-01",
        name: "Tuguegarao City LGU",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
