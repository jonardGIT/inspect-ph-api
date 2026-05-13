import type { Request } from "express";
import type { RequestHandler } from "express";
import { validationResult } from "express-validator";

import { AppError } from "./errors.js";

export function validateRequest(request: Request): void {
  const result = validationResult(request);

  if (result.isEmpty()) {
    return;
  }

  throw new AppError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed",
    result.array(),
  );
}

export const validateRequestMiddleware: RequestHandler = (
  request,
  _response,
  next,
) => {
  try {
    validateRequest(request);
    next();
  } catch (error) {
    next(error);
  }
};
