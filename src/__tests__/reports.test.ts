import request from "supertest";

const mockInspectionFindMany = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    inspection: {
      findMany: mockInspectionFindMany,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Reports routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("exports inspections as CSV for admin", async () => {
    const createdAt = new Date("2026-05-14T08:00:00.000Z");

    mockInspectionFindMany.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "COMPLETED",
        inspectorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        scheduledAt: createdAt,
        startedAt: createdAt,
        completedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        office: { code: "BPLO-01", name: "BPLO Main" },
        business: { businessName: "Test Business" },
        permitRecord: { permitNumber: "BP-2026-001" },
      },
    ]);

    const response = await request(app)
      .get("/api/v1/reports/inspections/export")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/csv/);
    expect(response.text).toContain("id,office_code,office_name");
    expect(response.text).toContain("Test Business");
    expect(response.text).toContain("BP-2026-001");
    expect(response.text).toContain("completed");
  });

  it("returns 403 for non-admin export attempts", async () => {
    const response = await request(app)
      .get("/api/v1/reports/inspections/export")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-1" })}`,
      );

    expect(response.status).toBe(403);
  });

  it("returns 401 for unauthenticated export attempts", async () => {
    const response = await request(app).get(
      "/api/v1/reports/inspections/export",
    );

    expect(response.status).toBe(401);
  });

  it("returns inspection twin simulation results for admins", async () => {
    const completedAt = new Date("2026-03-18T11:30:00.000Z");

    mockInspectionFindMany.mockResolvedValue([
      {
        business: {
          businessName: "North Star Trading",
          id: "business-1",
        },
        checklistResults: [{ status: "FAIL" }, { status: "PASS" }],
        completedAt,
        findings: [{ severity: "CRITICAL" }],
        id: "inspection-1",
        moduleCode: "FIRE",
        office: {
          code: "FIRE-01",
          id: "office-1",
          name: "Fire Safety Office",
        },
        permitRecord: {
          permitNumber: "FSIC-2026-001",
        },
        scheduledAt: new Date("2026-01-05T08:00:00.000Z"),
      },
    ]);

    const response = await request(app)
      .get("/api/v1/reports/inspection-twin")
      .query({
        failOnCriticalSeverity: "true",
        failOnHighSeverity: "false",
        fromDate: "2026-03-01T00:00:00.000Z",
        maxFailedChecklistItems: "0",
        minChecklistPassRatePct: "80",
        moduleCode: "FIRE",
        officeId: "11111111-1111-4111-8111-111111111111",
        toDate: "2026-03-31T23:59:59.999Z",
      })
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data.simulatedFailedCount).toBe(1);
    expect(response.body.data.failureRatePct).toBe(100);
    expect(response.body.data.records[0]).toMatchObject({
      businessName: "North Star Trading",
      completedAt: completedAt.toISOString(),
      permitNumber: "FSIC-2026-001",
      simulatedOutcome: "fail",
    });
  });

  it("rejects invalid twin simulator query values", async () => {
    const response = await request(app)
      .get("/api/v1/reports/inspection-twin")
      .query({ minChecklistPassRatePct: "140" })
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      );

    expect(response.status).toBe(400);
  });
});
