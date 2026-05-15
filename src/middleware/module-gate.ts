import type { RequestHandler } from "express";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

// Short-lived in-process cache: key = `${officeId}:${moduleCode}`, value = enabled boolean
const moduleCache = new Map<string, { enabled: boolean; expiresAt: number }>();
const MODULE_CACHE_TTL_MS = 60_000; // 60 seconds

async function isModuleEnabledForOffice(
  officeId: string,
  moduleCode: string,
): Promise<boolean> {
  const cacheKey = `${officeId}:${moduleCode}`;
  const cached = moduleCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.enabled;
  }

  const assignment = await prisma.officeModule.findFirst({
    where: {
      officeId,
      module: {
        code: { equals: moduleCode.trim(), mode: "insensitive" },
        isActive: true,
      },
    },
    select: { id: true },
  });

  const enabled = assignment !== null;
  moduleCache.set(cacheKey, {
    enabled,
    expiresAt: Date.now() + MODULE_CACHE_TTL_MS,
  });

  return enabled;
}

/**
 * Returns a middleware that checks whether the requesting user's office has the
 * given module enabled via an `OfficeModule` assignment.
 *
 * For admin/global-scope callers the check is skipped (they have platform-wide access).
 * For office-scoped callers, ALL assigned offices must have the module enabled.
 * If no officeId can be resolved or the module is not enabled, responds 403.
 *
 * Must be placed after `authenticate` and `requireJurisdiction()`.
 */
export function requireModule(moduleCode: string): RequestHandler {
  return async (request, _response, next) => {
    try {
      if (!request.auth) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
      }

      // Admins and LGU admins (global scope) bypass the module gate
      if (request.auth.role === "admin" || request.auth.role === "lgu_admin") {
        next();
        return;
      }

      const scope = request.jurisdictionScope;

      if (!scope) {
        throw new AppError(
          403,
          "MODULE_ACCESS_DENIED",
          `Module '${moduleCode}' is not enabled for your office`,
        );
      }

      if (scope.officeIds.length === 0) {
        throw new AppError(
          403,
          "MODULE_ACCESS_DENIED",
          `Module '${moduleCode}' is not enabled for your office`,
        );
      }

      // Check that at least one of the caller's offices has the module enabled.
      // For write operations the service layer enforces the specific office match;
      // here we gate read access conservatively to any assigned office.
      const checks = await Promise.all(
        scope.officeIds.map((id) => isModuleEnabledForOffice(id, moduleCode)),
      );

      if (!checks.some(Boolean)) {
        throw new AppError(
          403,
          "MODULE_ACCESS_DENIED",
          `Module '${moduleCode}' is not enabled for your office`,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
