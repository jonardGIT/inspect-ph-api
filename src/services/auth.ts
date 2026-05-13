import type { Prisma, User } from "@prisma/client";

import { getAuthProvider, type AuthRole } from "../lib/auth-provider.js";
import { AppError } from "../lib/errors.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";
import { normalizeUserRoleInput } from "../types/auth.js";

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
  refreshToken: string;
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
  name: string;
  role: AuthRole;
}

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

function toPublicUser(user: User): PublicUser {
  return {
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id,
    name: user.name,
    role: mapUserRole(user.role),
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

async function issueTokens(user: User): Promise<AuthResult["tokens"]> {
  const payload = {
    role: mapUserRole(user.role),
    sub: user.id,
  };

  return getAuthProvider().issueTokens(payload);
}

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
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
    tokens: await issueTokens(user),
    user: toPublicUser(user),
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
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
    tokens: await issueTokens(user),
    user: toPublicUser(user),
  };
}

export async function refreshSession(input: RefreshInput): Promise<AuthResult> {
  const payload = await getAuthProvider().verifyRefreshToken(
    input.refreshToken,
  );
  const user = await prisma.user.findUnique({
    where: {
      id: payload.sub,
    },
  });

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }

  return {
    tokens: await issueTokens(user),
    user: toPublicUser(user),
  };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
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
