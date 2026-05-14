import type { RequestHandler } from "express";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { UserRole } from "../types/auth.js";

export interface JurisdictionScope {
  accessScope: "assigned" | "global";
  lguIds: string[];
  officeIds: string[];
}

export async function resolveJurisdictionScope(input: {
  role: UserRole;
  userId: string;
}): Promise<JurisdictionScope> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      lguId: true,
      officeAssignments: {
        select: {
          office: {
            select: {
              id: true,
              lguId: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }

  const officeIds = Array.from(
    new Set(user.officeAssignments.map((assignment) => assignment.office.id)),
  );
  const lguIds = Array.from(
    new Set([
      ...(user.lguId ? [user.lguId] : []),
      ...user.officeAssignments.map((assignment) => assignment.office.lguId),
    ]),
  );

  return {
    accessScope: input.role === "admin" ? "global" : "assigned",
    lguIds,
    officeIds,
  };
}

export function requireJurisdiction(): RequestHandler {
  return async (request, _response, next) => {
    try {
      if (!request.auth) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
      }

      request.jurisdictionScope = await resolveJurisdictionScope({
        role: request.auth.role,
        userId: request.auth.sub,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}
