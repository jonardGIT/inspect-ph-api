import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";

import { isAppError } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          details: error.meta,
          message: "Resource violates a unique constraint",
        },
      });

      return;
    }
  }

  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        details: error.details,
        message: error.message,
      },
    });

    return;
  }

  console.error(error);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
