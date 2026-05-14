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
