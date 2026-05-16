import request from "supertest";

import app from "../app.js";
import { resetRateLimitStoreForTests } from "../middleware/rate-limit.js";

describe("GET /api/v1/health", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
  });

  it("returns a healthy status payload", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "healthy", db: "ok" } });
  });

  it("rate limits repeated health checks from the same client", async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(app).get("/api/v1/health");

      expect(response.status).toBe(200);
    }

    const limitedResponse = await request(app).get("/api/v1/health");

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    });
    expect(limitedResponse.headers["retry-after"]).toEqual(expect.any(String));
  });
});
