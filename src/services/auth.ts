import type { Prisma, User } from "@prisma/client";

import { getAuthProvider, type AuthRole } from "../lib/auth-provider.js";
import { AppError } from "../lib/errors.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";
import {
  assertRefreshSessionActive,
  issueAuthSessionTokens,
} from "./auth-sessions.js";
import {
  normalizeUserRoleInput,
  ROLE_PROFILES,
  type AccessScope,
} from "../types/auth.js";

interface BootstrapAdminInput {
  email: string;
  name: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RefreshInput {
  ipAddress?: string;
  refreshToken: string;
  userAgent?: string;
}

interface ListUsersInput {
  limit: number;
  page: number;
  role?: AuthRole;
  search?: string;
  skip: number;
}

interface PublicUser {
  createdAt: string;
  email: string;
  id: string;
  lguId?: string;
  businessId?: string;
  name: string;
  officeIds: string[];
  role: AuthRole;
  roleProfile: {
    accessScope: AccessScope;
    label: string;
    permissions: string[];
  };
}

type UserWithScope = Prisma.UserGetPayload<{
  include: {
    officeAssignments: {
      select: {
        officeId: true;
      };
    };
  };
}>;

interface AuthResult {
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  user: PublicUser;
}

function mapUserRole(role: User["role"]): AuthRole {
  const mappedRole = normalizeUserRoleInput(role);

  if (!mappedRole) {
    throw new AppError(500, "INVALID_USER_ROLE", "User role is not supported");
  }

  return mappedRole;
}

function toPublicUser(user: UserWithScope): PublicUser {
  const role = mapUserRole(user.role);
  const roleProfile = ROLE_PROFILES[role];

  return {
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id,
    lguId: user.lguId ?? undefined,
    businessId: user.businessId ?? undefined,
    name: user.name,
    officeIds: user.officeAssignments.map((assignment) => assignment.officeId),
    role,
    roleProfile: {
      accessScope: roleProfile.scope,
      label: roleProfile.label,
      permissions: [...roleProfile.permissions],
    },
  };
}

function buildUserWhere(input: ListUsersInput): Prisma.UserWhereInput {
  const clauses: Prisma.UserWhereInput[] = [];

  if (input.role) {
    clauses.push({
      role: input.role.toUpperCase() as User["role"],
    });
  }

  if (input.search) {
    const value = input.search.trim();

    if (value) {
      clauses.push({
        OR: [
          { id: { equals: value } },
          { email: { contains: value, mode: "insensitive" } },
          { name: { contains: value, mode: "insensitive" } },
        ],
      });
    }
  }

  if (clauses.length === 0) {
    return {};
  }

  return { AND: clauses };
}

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
  sessionContext?: { ipAddress?: string; userAgent?: string },
): Promise<AuthResult> {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    throw new AppError(
      409,
      "BOOTSTRAP_COMPLETED",
      "Admin bootstrap is no longer available",
    );
  }

  const user = await prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: "ADMIN",
    },
    include: {
      officeAssignments: {
        select: {
          officeId: true,
        },
      },
    },
  });

  await recordAuditLog({
    action: "auth.bootstrap_admin",
    actorRole: "admin",
    actorUserId: user.id,
    entityId: user.id,
    entityType: "user",
    summary: `Bootstrapped initial admin account for ${user.email}`,
  });

  return {
    tokens: (
      await issueAuthSessionTokens({
        ipAddress: sessionContext?.ipAddress,
        userAgent: sessionContext?.userAgent,
        userId: user.id,
        userRole: mapUserRole(user.role),
      })
    ).tokens,
    user: toPublicUser(user),
  };
}

export async function login(
  input: LoginInput,
  sessionContext?: { ipAddress?: string; userAgent?: string },
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    include: {
      officeAssignments: {
        select: {
          officeId: true,
        },
      },
    },
    where: {
      email: input.email.trim().toLowerCase(),
    },
  });

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid credentials");
  }

  const passwordMatches = await comparePassword(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid credentials");
  }

  await recordAuditLog({
    action: "auth.login",
    actorRole: mapUserRole(user.role),
    actorUserId: user.id,
    entityId: user.id,
    entityType: "user",
    summary: `Signed in as ${user.email}`,
  });

  return {
    tokens: (
      await issueAuthSessionTokens({
        ipAddress: sessionContext?.ipAddress,
        userAgent: sessionContext?.userAgent,
        userId: user.id,
        userRole: mapUserRole(user.role),
      })
    ).tokens,
    user: toPublicUser(user),
  };
}

export async function refreshSession(input: RefreshInput): Promise<AuthResult> {
  const payload = await getAuthProvider().verifyRefreshToken(
    input.refreshToken,
  );
  const user = await prisma.user.findUnique({
    include: {
      officeAssignments: {
        select: {
          officeId: true,
        },
      },
    },
    where: {
      id: payload.sub,
    },
  });

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }

  if (!payload.sid) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }

  await assertRefreshSessionActive({
    refreshToken: input.refreshToken,
    sessionId: payload.sid,
    userId: payload.sub,
  });

  return {
    tokens: (
      await issueAuthSessionTokens({
        existingSessionId: payload.sid,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        userId: user.id,
        userRole: mapUserRole(user.role),
      })
    ).tokens,
    user: toPublicUser(user),
  };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    include: {
      officeAssignments: {
        select: {
          officeId: true,
        },
      },
    },
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return toPublicUser(user);
}

export async function listUsers(input: ListUsersInput): Promise<{
  data: PublicUser[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildUserWhere(input);
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      include: {
        officeAssignments: {
          select: {
            officeId: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: users.map(toPublicUser),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function updateExpoPushToken(
  userId: string,
  token: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { expoPushToken: token },
  });
}

export interface RegisterUserInput {
  email: string;
  name: string;
  password: string;
  role: "business_owner" | "citizen";
  /** Required when role is business_owner */
  businessId?: string;
}

export async function registerUser(
  input: RegisterUserInput,
  sessionContext?: { ipAddress?: string; userAgent?: string },
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
  }

  if (input.role === "business_owner") {
    if (!input.businessId) {
      throw new AppError(400, "BUSINESS_ID_REQUIRED", "businessId is required for business_owner registration");
    }

    const business = await prisma.businessEstablishment.findUnique({
      where: { id: input.businessId },
    });

    if (!business) {
      throw new AppError(404, "BUSINESS_NOT_FOUND", "Business not found");
    }
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role === "business_owner" ? "BUSINESS_OWNER" : "CITIZEN",
      ...(input.role === "business_owner" && input.businessId
        ? { businessId: input.businessId }
        : {}),
    },
    include: {
      officeAssignments: {
        select: { officeId: true },
      },
    },
  });

  await recordAuditLog({
    action: "auth.register",
    actorRole: input.role,
    actorUserId: user.id,
    entityId: user.id,
    entityType: "user",
    summary: `Registered ${input.role} account for ${user.email}`,
  });

  return {
    tokens: (
      await issueAuthSessionTokens({
        ipAddress: sessionContext?.ipAddress,
        userAgent: sessionContext?.userAgent,
        userId: user.id,
        userRole: mapUserRole(user.role),
      })
    ).tokens,
    user: toPublicUser(user),
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  const isValid = await comparePassword(currentPassword, user.passwordHash);

  if (!isValid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    data: { passwordHash: newHash },
    where: { id: userId },
  });
}
