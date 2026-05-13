import type { Prisma, UserRole } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { normalizeUserRoleInput } from "../types/auth.js";

export interface PublicUserOfficeAssignment {
  createdAt: string;
  id: string;
  office: {
    code: string;
    id: string;
    lguId: string;
    name: string;
  };
  user: {
    email: string;
    id: string;
    name: string;
    role: "admin" | "inspector";
  };
}

function mapUserRole(role: UserRole) {
  return normalizeUserRoleInput(role) ?? "inspector";
}

function toPublicUserOfficeAssignment(
  record: Prisma.UserOfficeAssignmentGetPayload<{
    include: {
      office: true;
      user: {
        select: {
          email: true;
          id: true;
          name: true;
          role: true;
        };
      };
    };
  }>,
): PublicUserOfficeAssignment {
  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    office: {
      code: record.office.code,
      id: record.office.id,
      lguId: record.office.lguId,
      name: record.office.name,
    },
    user: {
      email: record.user.email,
      id: record.user.id,
      name: record.user.name,
      role: mapUserRole(record.user.role),
    },
  };
}

export async function listUserOfficeAssignments(userId: string) {
  const assignments = await prisma.userOfficeAssignment.findMany({
    include: {
      office: true,
      user: {
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    where: { userId },
  });

  return assignments.map(toPublicUserOfficeAssignment);
}

export async function createUserOfficeAssignment(input: {
  officeId: string;
  userId: string;
}) {
  const [user, office] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId } }),
    prisma.office.findUnique({ where: { id: input.officeId } }),
  ]);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  if (!office) {
    throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found");
  }

  const assignment = await prisma.userOfficeAssignment.upsert({
    where: {
      userId_officeId: {
        officeId: input.officeId,
        userId: input.userId,
      },
    },
    create: {
      officeId: input.officeId,
      userId: input.userId,
    },
    update: {},
    include: {
      office: true,
      user: {
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  return toPublicUserOfficeAssignment(assignment);
}

export async function deleteUserOfficeAssignment(input: {
  assignmentId: string;
  userId: string;
}) {
  const assignment = await prisma.userOfficeAssignment.findFirst({
    where: {
      id: input.assignmentId,
      userId: input.userId,
    },
  });

  if (!assignment) {
    throw new AppError(
      404,
      "USER_OFFICE_ASSIGNMENT_NOT_FOUND",
      "User office assignment not found",
    );
  }

  await prisma.userOfficeAssignment.delete({
    where: { id: input.assignmentId },
  });
}
