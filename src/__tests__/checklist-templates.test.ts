import request from "supertest";

const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    checklistTemplate: {
      count: mockCount,
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const TEMPLATE = {
  code: "SANITA_WATER",
  createdAt: new Date("2026-05-14T08:00:00.000Z"),
  description: "Water supply safety check",
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  isActive: true,
  module: "SANITA",
  sortOrder: 1,
  title: "Water supply",
  updatedAt: new Date("2026-05-14T08:00:00.000Z"),
};

describe("Checklist template routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists templates for authenticated users", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([TEMPLATE]);

    const response = await request(app)
      .get("/api/v1/checklist-templates?module=SANITA&page=1")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].code).toBe("SANITA_WATER");
    expect(response.body.data[0].module).toBe("SANITA");
    expect(response.body.meta.total).toBe(1);
  });

  it("returns 401 for unauthenticated list request", async () => {
    const response = await request(app).get("/api/v1/checklist-templates");

    expect(response.status).toBe(401);
  });

  it("gets a single template by id", async () => {
    mockFindUnique.mockResolvedValue(TEMPLATE);

    const response = await request(app)
      .get(`/api/v1/checklist-templates/${TEMPLATE.id}`)
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(TEMPLATE.id);
  });

  it("returns 404 for unknown template id", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/v1/checklist-templates/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-1" })}`,
      );

    expect(response.status).toBe(404);
  });

  it("creates a template as admin", async () => {
    mockFindUnique.mockResolvedValue(null); // no duplicate
    mockCreate.mockResolvedValue(TEMPLATE);

    const response = await request(app)
      .post("/api/v1/checklist-templates")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      )
      .send({
        code: "SANITA_WATER",
        isActive: true,
        module: "SANITA",
        sortOrder: 1,
        title: "Water supply",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.code).toBe("SANITA_WATER");
  });

  it("rejects template creation without required fields", async () => {
    const response = await request(app)
      .post("/api/v1/checklist-templates")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      )
      .send({ description: "Missing code, module, and title" });

    expect(response.status).toBe(400);
  });

  it("returns 403 for non-admin template creation", async () => {
    const response = await request(app)
      .post("/api/v1/checklist-templates")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "inspector", sub: "user-1" })}`,
      )
      .send({
        code: "SANITA_WATER",
        module: "SANITA",
        title: "Water supply",
      });

    expect(response.status).toBe(403);
  });

  it("toggles template active state", async () => {
    mockFindUnique.mockResolvedValue(TEMPLATE);
    mockUpdate.mockResolvedValue({ ...TEMPLATE, isActive: false });

    const response = await request(app)
      .patch(`/api/v1/checklist-templates/${TEMPLATE.id}/active`)
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      )
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);
  });
});
