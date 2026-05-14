import request from "supertest";

const mockIssueReportCount = jest.fn();
const mockIssueReportCreate = jest.fn();
const mockIssueReportFindMany = jest.fn();
const mockIssueReportFindUnique = jest.fn();
const mockIssueReportUpdate = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    issueReport: {
      count: mockIssueReportCount,
      create: mockIssueReportCreate,
      findUnique: mockIssueReportFindUnique,
      findMany: mockIssueReportFindMany,
      update: mockIssueReportUpdate,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Issue report routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists issue reports for authenticated users", async () => {
    const createdAt = new Date("2026-05-18T09:15:00.000Z");

    mockIssueReportCount.mockResolvedValue(1);
    mockIssueReportFindMany.mockResolvedValue([
      {
        category: "FIRE_HAZARD",
        createdAt,
        description: "Open wiring near the storefront meter.",
        id: "issue-1",
        locationAccuracyMeters: null,
        locationDescription: "Corner of Mabini and Luna",
        locationLatitude: null,
        locationLongitude: null,
        reportNumber: "IR-20260518-ABCD1234",
        reporterEmail: "owner@example.com",
        reporterName: "Alex Dela Cruz",
        reporterPhone: "09171234567",
        status: "SUBMITTED",
        subject: "Exposed electrical wiring",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/issue-reports?page=1&limit=10&status=submitted")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 10, page: 1, total: 1 });
    expect(response.body.data[0].reportNumber).toBe("IR-20260518-ABCD1234");
  });

  it("requires authentication to list issue reports", async () => {
    const response = await request(app).get("/api/v1/issue-reports");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("looks up a public issue report by report number", async () => {
    const createdAt = new Date("2026-05-18T09:15:00.000Z");

    mockIssueReportFindMany.mockResolvedValue([]);
    mockIssueReportCreate.mockResolvedValue(undefined);
    mockIssueReportCount.mockResolvedValue(0);
    mockIssueReportFindUnique.mockResolvedValue({
      category: "FIRE_HAZARD",
      createdAt,
      description: "Open wiring near the storefront meter.",
      id: "issue-1",
      locationAccuracyMeters: null,
      locationDescription: "Corner of Mabini and Luna",
      locationLatitude: null,
      locationLongitude: null,
      reportNumber: "IR-20260518-ABCD1234",
      reporterEmail: "owner@example.com",
      reporterName: "Alex Dela Cruz",
      reporterPhone: "09171234567",
      status: "SUBMITTED",
      subject: "Exposed electrical wiring",
      updatedAt: createdAt,
    });

    const response = await request(app).get(
      "/api/v1/issue-reports/public/IR-20260518-ABCD1234",
    );

    expect(response.status).toBe(200);
    expect(response.body.data.reportNumber).toBe("IR-20260518-ABCD1234");
    expect(response.body.data.status).toBe("submitted");
  });

  it("updates an issue report status for authenticated users", async () => {
    const updatedAt = new Date("2026-05-18T10:45:00.000Z");

    mockIssueReportFindUnique.mockResolvedValue({ id: "issue-1" });
    mockIssueReportUpdate.mockResolvedValue({
      category: "FIRE_HAZARD",
      createdAt: new Date("2026-05-18T09:15:00.000Z"),
      description: "Open wiring near the storefront meter.",
      id: "issue-1",
      locationAccuracyMeters: null,
      locationDescription: "Corner of Mabini and Luna",
      locationLatitude: null,
      locationLongitude: null,
      reportNumber: "IR-20260518-ABCD1234",
      reporterEmail: "owner@example.com",
      reporterName: "Alex Dela Cruz",
      reporterPhone: "09171234567",
      status: "UNDER_REVIEW",
      subject: "Exposed electrical wiring",
      updatedAt,
    });

    const response = await request(app)
      .patch("/api/v1/issue-reports/issue-1/status")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      )
      .send({ status: "under_review" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("under_review");
    expect(mockIssueReportUpdate).toHaveBeenCalledWith({
      data: { status: "UNDER_REVIEW" },
      where: { id: "issue-1" },
    });
  });

  it("creates a public issue report", async () => {
    const createdAt = new Date("2026-05-18T09:15:00.000Z");

    mockIssueReportCreate.mockResolvedValue({
      category: "FIRE_HAZARD",
      createdAt,
      description: "Open wiring near the storefront meter.",
      id: "issue-1",
      locationAccuracyMeters: null,
      locationDescription: "Corner of Mabini and Luna",
      locationLatitude: null,
      locationLongitude: null,
      reportNumber: "IR-20260518-ABCD1234",
      reporterEmail: "owner@example.com",
      reporterName: "Alex Dela Cruz",
      reporterPhone: "09171234567",
      status: "SUBMITTED",
      subject: "Exposed electrical wiring",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/issue-reports/public")
      .send({
        category: "fire_hazard",
        description: "Open wiring near the storefront meter.",
        locationDescription: "Corner of Mabini and Luna",
        reporterEmail: "owner@example.com",
        reporterName: "Alex Dela Cruz",
        reporterPhone: "09171234567",
        subject: "Exposed electrical wiring",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      category: "fire_hazard",
      createdAt: createdAt.toISOString(),
      description: "Open wiring near the storefront meter.",
      id: "issue-1",
      locationDescription: "Corner of Mabini and Luna",
      reportNumber: "IR-20260518-ABCD1234",
      reporterEmail: "owner@example.com",
      reporterName: "Alex Dela Cruz",
      reporterPhone: "09171234567",
      status: "submitted",
      subject: "Exposed electrical wiring",
      updatedAt: createdAt.toISOString(),
    });
  });

  it("validates required public issue report fields", async () => {
    const response = await request(app)
      .post("/api/v1/issue-reports/public")
      .send({
        category: "invalid-category",
        description: "",
        subject: "",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});