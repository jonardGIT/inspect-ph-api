import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { getAuthProvider, type AuthRole } from "../lib/auth-provider.js";
import { AppError } from "../lib/errors.js";
import { getRefreshTokenExpiresInSeconds } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";

export interface PublicAuthSession {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress?: string;
  isCurrent: boolean;
  lastUsedAt: string;
  revokedAt?: string;
  user?: {
    email: string;
    id: string;
    name: string;
    role: AuthRole;
  };
  userAgent?: string;
}

type AuthSessionRecord = Prisma.AuthSessionGetPayload<{
  include: {
    user: {
      select: {
        email: true;
        id: true;
        name: true;
        role: true;
      };
    };
  };
}>;

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getRefreshExpiryDate(): Date {
  return new Date(Date.now() + getRefreshTokenExpiresInSeconds() * 1000);
}

function isSessionInactive(record: {
  expiresAt: Date;
  revokedAt: Date | null;
}) {
  return Boolean(record.revokedAt) || record.expiresAt.getTime() <= Date.now();
}

function toPublicAuthSession(
  record: AuthSessionRecord,
  currentSessionId?: string,
): PublicAuthSession {
  return {
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    id: record.id,
    ipAddress: record.ipAddress ?? undefined,
    isCurrent: record.id === currentSessionId,
    lastUsedAt: record.lastUsedAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString(),
    user: {
      email: record.user.email,
      id: record.user.id,
      name: record.user.name,
      role: record.user.role.toLowerCase() as AuthRole,
    },
    userAgent: record.userAgent ?? undefined,
  };
}

export async function issueAuthSessionTokens(input: {
  existingSessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  userId: string;
  userRole: AuthRole;
}): Promise<{
  tokens: {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
  };
}> {
  const sessionId = input.existingSessionId ?? randomUUID();
  const tokens = await getAuthProvider().issueTokens({
    role: input.userRole,
    sid: sessionId,
    sub: input.userId,
  });
  const data = {
    expiresAt: getRefreshExpiryDate(),
    ipAddress: input.ipAddress?.trim() || null,
    lastUsedAt: new Date(),
    refreshTokenHash: hashRefreshToken(tokens.refreshToken),
    revokedAt: null,
    userAgent: input.userAgent?.trim() || null,
  };

  if (input.existingSessionId) {
    await prisma.authSession.update({
      data,
      where: { id: input.existingSessionId },
    });
  } else {
    await prisma.authSession.create({
      data: {
        ...data,
        id: sessionId,
        userId: input.userId,
      },
    });
  }

  return { tokens };
}

export async function assertAuthSessionActive(input: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  const session = await prisma.authSession.findUnique({
    where: { id: input.sessionId },
  });

  if (
    !session ||
    session.userId !== input.userId ||
    isSessionInactive(session)
  ) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }
}

export async function assertRefreshSessionActive(input: {
  refreshToken: string;
  sessionId: string;
  userId: string;
}): Promise<void> {
  const session = await prisma.authSession.findUnique({
    where: { id: input.sessionId },
  });

  if (
    !session ||
    session.userId !== input.userId ||
    session.refreshTokenHash !== hashRefreshToken(input.refreshToken) ||
    isSessionInactive(session)
  ) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }
}

export async function listAuthSessions(input: {
  currentSessionId?: string;
  userId: string;
}): Promise<PublicAuthSession[]> {
  const sessions = await prisma.authSession.findMany({
    include: {
      user: {
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    where: {
      expiresAt: { gt: new Date() },
      revokedAt: null,
      userId: input.userId,
    },
  });

  return sessions.map((session) =>
    toPublicAuthSession(session, input.currentSessionId),
  );
}

export async function revokeAuthSession(input: {
  actorRole: AuthRole;
  actorUserId: string;
  sessionId: string;
}): Promise<void> {
  const session = await prisma.authSession.findUnique({
    include: {
      user: {
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
        },
      },
    },
    where: { id: input.sessionId },
  });

  if (!session) {
    throw new AppError(404, "AUTH_SESSION_NOT_FOUND", "Session not found");
  }

  if (input.actorRole !== "admin" && session.userId !== input.actorUserId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have access to this resource",
    );
  }

  if (!session.revokedAt) {
    await prisma.authSession.update({
      data: { revokedAt: new Date() },
      where: { id: input.sessionId },
    });
  }

  await recordAuditLog({
    action: "auth.session_revoked",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    entityId: session.userId,
    entityType: "user",
    summary: `Revoked session ${session.id} for ${session.user.email}`,
  });
}
