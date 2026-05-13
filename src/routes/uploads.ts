import express, { Router } from "express";
import { param } from "express-validator";

import { asyncHandler } from "../lib/async-handler.js";
import { validateRequestMiddleware } from "../lib/validation.js";
import {
  getLocalAttachmentBinary,
  uploadLocalAttachmentBinary,
} from "../services/uploads.js";

const router = Router();

router.get(
  "/local/:token",
  [param("token").isString().notEmpty(), validateRequestMiddleware],
  asyncHandler(async (request, response) => {
    const result = await getLocalAttachmentBinary({
      token: String(request.params.token),
    });

    response.setHeader("Content-Type", result.mimeType);
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${result.fileName.replace(/"/g, "")}"`,
    );

    response.sendFile(result.absolutePath);
  }),
);

router.put(
  "/local/:token",
  [param("token").isString().notEmpty(), validateRequestMiddleware],
  express.raw({ limit: "15mb", type: () => true }),
  asyncHandler(async (request, response) => {
    const result = await uploadLocalAttachmentBinary({
      body: Buffer.isBuffer(request.body)
        ? request.body
        : Buffer.from(request.body ?? ""),
      mimeType: request.header("content-type") || undefined,
      token: String(request.params.token),
    });

    response.status(201).json({ data: result });
  }),
);

export default router;
