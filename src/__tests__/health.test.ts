import request from "supertest";

import app from "../app.js";

describe("GET /api/v1/health", () => {
  it("returns a healthy status payload", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "healthy" } });
  });
});
