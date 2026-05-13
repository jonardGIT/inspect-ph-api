import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";

import request from "supertest";

import app from "../app.js";
import {
  signLocalDownloadToken,
  signLocalUploadToken,
} from "../lib/upload-token.js";

describe("Upload routes", () => {
  let uploadsDir: string;

  beforeEach(async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@localhost:5432/inspect_ph";
    process.env.JWT_SECRET = "test-secret";
    process.env.STORAGE_PROVIDER = "local";
    uploadsDir = await mkdtemp(path.join(os.tmpdir(), "inspect-ph-uploads-"));
    process.env.UPLOADS_DIR = uploadsDir;
  });

  afterEach(async () => {
    await rm(uploadsDir, { force: true, recursive: true });
  });

  it("stores uploaded bytes for a valid local upload token", async () => {
    const storageKey = "inspections/inspection-1/2026-05-13/evidence.jpg";
    const token = signLocalUploadToken({ storageKey });
    const payload = Buffer.from("binary-image-payload");

    const response = await request(app)
      .put(`/api/v1/uploads/local/${token}`)
      .set("Content-Type", "image/jpeg")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        fileSizeBytes: payload.length,
        mimeType: "image/jpeg",
        storageKey,
        uploaded: true,
      },
    });

    const savedFile = await readFile(path.join(uploadsDir, storageKey));

    expect(savedFile.equals(payload)).toBe(true);
  });

  it("rejects invalid upload tokens", async () => {
    const response = await request(app)
      .put("/api/v1/uploads/local/not-a-valid-token")
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("payload"));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_UPLOAD_TOKEN",
        details: undefined,
        message: "Upload token is invalid",
      },
    });
  });

  it("serves stored bytes for a valid local download token", async () => {
    const storageKey = "inspections/inspection-1/2026-05-13/evidence.jpg";
    const payload = Buffer.from("binary-image-payload");
    const uploadToken = signLocalUploadToken({ storageKey });
    const downloadToken = signLocalDownloadToken({
      fileName: "evidence.jpg",
      mimeType: "image/jpeg",
      storageKey,
    });

    await request(app)
      .put(`/api/v1/uploads/local/${uploadToken}`)
      .set("Content-Type", "image/jpeg")
      .send(payload)
      .expect(201);

    const response = await request(app).get(
      `/api/v1/uploads/local/${downloadToken}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/jpeg");
    expect(Buffer.from(response.body).equals(payload)).toBe(true);
  });

  it("rejects invalid download tokens", async () => {
    const response = await request(app).get(
      "/api/v1/uploads/local/not-a-valid-download-token",
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_DOWNLOAD_TOKEN",
        details: undefined,
        message: "Download token is invalid",
      },
    });
  });
});
