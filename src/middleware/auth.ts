import type { NextFunction, Request, RequestHandler, Response } from "express";

import { getAuthProvider } from "../lib/auth-provider.js";
import { AppError } from "../lib/errors.js";
import type { UserRole } from "../types/auth.js";

function extractBearerToken(request: Request): string {
  const authorization = request.header("authorization");

  if (!authorization) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }

  return token;
}

export const authenticate: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const token = extractBearerToken(request);
    request.auth = await getAuthProvider().verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

export function authorize(...roles: UserRole[]): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      if (!request.auth) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
      }

      if (!roles.includes(request.auth.role)) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "You do not have access to this resource",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
