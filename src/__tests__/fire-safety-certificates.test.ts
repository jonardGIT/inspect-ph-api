import request from "supertest";

const mockCertificateCount = jest.fn();
const mockCertificateCreate = jest.fn();
const mockCertificateFindFirst = jest.fn();
const mockCertificateFindMany = jest.fn();
const mockCertificateFindUnique = jest.fn();
const mockInspectionFindUnique = jest.fn();
const mockOfficeModuleFindFirst = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
    },
    fireSafetyCertificate: {
      count: mockCertificateCount,
      create: mockCertificateCreate,
      findFirst: mockCertificateFindFirst,
      findMany: mockCertificateFindMany,
      findUnique: mockCertificateFindUnique,
    },
    inspection: {
      findUnique: mockInspectionFindUnique,
    },
    officeModule: {
      findFirst: mockOfficeModuleFindFirst,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Fire safety certificate routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    mockUserFindUnique.mockResolvedValue({
      lguId: "11111111-1111-4111-8111-111111111111",
      officeAssignments: [
        {
          office: {
            id: "c31cb14f-4b7c-4291-aea4-44ad4b0d89a6",
            lguId: "11111111-1111-4111-8111-111111111111",
          },
        },
      ],
    });
    mockOfficeModuleFindFirst.mockResolvedValue({ id: "office-module-1" });
    mockAuditLogCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("lists scoped fire safety certificates for inspectors", async () => {
    const issuedAt = new Date("2026-05-17T13:30:00.000Z");

    mockCertificateCount.mockResolvedValue(1);
    mockCertificateFindMany.mockResolvedValue([
      {
        certificateNumber: "FSIC-DEV-2026-0001",
        createdAt: issuedAt,
        expiresAt: new Date("2027-05-17T13:30:00.000Z"),
        id: "certificate-1",
        inspection: {
          business: {
            businessName: "Apex Cold Storage",
            id: "business-1",
          },
          completedAt: null,
          id: "inspection-1",
          office: {
            code: "FIRE-HQ",
            id: "c31cb14f-4b7c-4291-aea4-44ad4b0d89a6",
            lguId: "11111111-1111-4111-8111-111111111111",
            name: "Fire Safety Headquarters",
          },
          permitRecord: {
            id: "permit-1",
            permitNumber: "FIRE-DEV-2026-0001",
          },
          scheduledAt: issuedAt,
          status: "SCHEDULED",
        },
        issuedAt,
        remarks: "Seeded certificate",
        status: "ISSUED",
        updatedAt: issuedAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/fire-safety-certificates?page=1&limit=10")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "inspector-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 10, page: 1, total: 1 });
    expect(response.body.data[0]).toEqual({
      certificateNumber: "FSIC-DEV-2026-0001",
      createdAt: issuedAt.toISOString(),
      expiresAt: "2027-05-17T13:30:00.000Z",
      id: "certificate-1",
      inspection: {
        business: {
          businessName: "Apex Cold Storage",
          id: "business-1",
        },
        id: "inspection-1",
        office: {
          code: "FIRE-HQ",
          id: "c31cb14f-4b7c-4291-aea4-44ad4b0d89a6",
          lguId: "11111111-1111-4111-8111-111111111111",
          name: "Fire Safety Headquarters",
        },
        permit: {
          id: "permit-1",
          permitNumber: "FIRE-DEV-2026-0001",
        },
        scheduledAt: issuedAt.toISOString(),
        status: "scheduled",
      },
      issuedAt: issuedAt.toISOString(),
      remarks: "Seeded certificate",
      status: "issued",
      updatedAt: issuedAt.toISOString(),
    });
  });

  it("returns a public certificate lookup by certificate number", async () => {
    const issuedAt = new Date("2026-05-17T13:30:00.000Z");

    mockCertificateFindUnique.mockResolvedValue({
      certificateNumber: "FSIC-DEV-2026-0001",
      createdAt: issuedAt,
      expiresAt: new Date("2027-05-17T13:30:00.000Z"),
      id: "certificate-1",
      inspection: {
        business: {
          businessName: "Apex Cold Storage",
        },
        completedAt: null,
        office: {
          code: "FIRE-HQ",
          moduleAssignments: [
            {
              module: {
                code: "FIRE",
              },
            },
          ],
          name: "Fire Safety Headquarters",
        },
        permitRecord: {
          permitNumber: "FIRE-DEV-2026-0001",
        },
        scheduledAt: issuedAt,
        status: "SCHEDULED",
      },
      issuedAt,
      remarks: "Seeded certificate",
      status: "ISSUED",
      updatedAt: issuedAt,
    });

    const response = await request(app).get(
      "/api/v1/fire-safety-certificates/public/FSIC-DEV-2026-0001",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      business: {
        businessName: "Apex Cold Storage",
      },
      certificateNumber: "FSIC-DEV-2026-0001",
      expiresAt: "2027-05-17T13:30:00.000Z",
      inspection: {
        scheduledAt: issuedAt.toISOString(),
        status: "scheduled",
      },
      issuedAt: issuedAt.toISOString(),
      office: {
        code: "FIRE-HQ",
        name: "Fire Safety Headquarters",
      },
      permit: {
        permitNumber: "FIRE-DEV-2026-0001",
      },
      remarks: "Seeded certificate",
      status: "issued",
    });
  });

  it("returns a scoped certificate by inspection id", async () => {
    const issuedAt = new Date("2026-05-17T13:30:00.000Z");

    mockCertificateFindFirst.mockResolvedValue({
      certificateNumber: "FSIC-DEV-2026-0001",
      createdAt: issuedAt,
      expiresAt: new Date("2027-05-17T13:30:00.000Z"),
      id: "certificate-1",
      inspection: {
        business: {
          businessName: "Apex Cold Storage",
          id: "business-1",
        },
        completedAt: null,
        id: "62364cb8-8d0c-4185-b648-ee8d4f114594",
        office: {
          code: "FIRE-HQ",
          id: "c31cb14f-4b7c-4291-aea4-44ad4b0d89a6",
          lguId: "11111111-1111-4111-8111-111111111111",
          name: "Fire Safety Headquarters",
        },
        permitRecord: {
          id: "permit-1",
          permitNumber: "FIRE-DEV-2026-0001",
        },
        scheduledAt: issuedAt,
        status: "SCHEDULED",
      },
      issuedAt,
      remarks: null,
      status: "ISSUED",
      updatedAt: issuedAt,
    });

    const response = await request(app)
      .get(
        "/api/v1/fire-safety-certificates/inspection/62364cb8-8d0c-4185-b648-ee8d4f114594",
      )
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "inspector-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data.certificateNumber).toBe("FSIC-DEV-2026-0001");
  });

  it("creates a fire safety certificate for FireGuard inspections", async () => {
    const issuedAt = new Date("2026-05-17T13:30:00.000Z");

    mockInspectionFindUnique.mockResolvedValue({
      id: "62364cb8-8d0c-4185-b648-ee8d4f114594",
      permitRecordId: "permit-1",
      status: "COMPLETED",
      office: {
        code: "FIRE-HQ",
        moduleAssignments: [
          {
            module: {
              code: "FIRE",
            },
          },
        ],
      },
    });
    mockCertificateFindFirst.mockResolvedValue(null);
    mockCertificateCount.mockResolvedValue(1);
    mockCertificateCreate.mockResolvedValue({
      certificateNumber: "FSIC-DEV-2026-0002",
      createdAt: issuedAt,
      expiresAt: new Date("2027-05-17T13:30:00.000Z"),
      id: "certificate-2",
      inspection: {
        business: {
          businessName: "Apex Cold Storage",
          id: "business-1",
        },
        completedAt: null,
        id: "62364cb8-8d0c-4185-b648-ee8d4f114594",
        office: {
          code: "FIRE-HQ",
          id: "c31cb14f-4b7c-4291-aea4-44ad4b0d89a6",
          lguId: "11111111-1111-4111-8111-111111111111",
          name: "Fire Safety Headquarters",
        },
        permitRecord: {
          id: "permit-1",
          permitNumber: "FIRE-DEV-2026-0001",
        },
        scheduledAt: issuedAt,
        status: "SCHEDULED",
      },
      issuedAt,
      remarks: "Created from the API test",
      status: "ISSUED",
      updatedAt: issuedAt,
    });

    const response = await request(app)
      .post("/api/v1/fire-safety-certificates")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      )
      .send({
        certificateNumber: "FSIC-DEV-2026-0002",
        expiresAt: "2027-05-17T13:30:00.000Z",
        inspectionId: "62364cb8-8d0c-4185-b648-ee8d4f114594",
        issuedAt: "2026-05-17T13:30:00.000Z",
        remarks: "Created from the API test",
        status: "issued",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.certificateNumber).toBe("FSIC-DEV-2026-0002");
    expect(mockCertificateCreate).toHaveBeenCalledWith({
      data: {
        certificateNumber: expect.any(String),
        expiresAt: new Date("2027-05-17T13:30:00.000Z"),
        inspectionId: "62364cb8-8d0c-4185-b648-ee8d4f114594",
        issuedAt: new Date("2026-05-17T13:30:00.000Z"),
        remarks: "Created from the API test",
        status: "ISSUED",
      },
      include: {
        inspection: {
          select: {
            business: {
              select: {
                businessName: true,
                id: true,
              },
            },
            completedAt: true,
            id: true,
            office: {
              select: {
                code: true,
                id: true,
                lguId: true,
                name: true,
              },
            },
            permitRecord: {
              select: {
                id: true,
                permitNumber: true,
              },
            },
            scheduledAt: true,
            status: true,
          },
        },
      },
    });
  });
});
