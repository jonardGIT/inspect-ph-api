import jwt from "jsonwebtoken";

import { AppError } from "./errors.js";
import { isUserRole, type UserRole } from "../types/auth.js";

export type AuthRole = UserRole;

export interface AuthTokenPayload {
  role: AuthRole;
  sid?: string;
  sub: string;
}

const DEFAULT_JWT_EXPIRES_IN = "15m";
const DEFAULT_JWT_REFRESH_EXPIRES_IN = "7d";

type TokenType = "access" | "refresh";

interface SignedTokenPayload extends AuthTokenPayload {
  type: TokenType;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }

  return secret;
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN?.trim() || DEFAULT_JWT_EXPIRES_IN;
}

function getJwtRefreshExpiresIn(): string {
  return (
    process.env.JWT_REFRESH_EXPIRES_IN?.trim() || DEFAULT_JWT_REFRESH_EXPIRES_IN
  );
}

function parseDurationToSeconds(rawValue: string): number {
  if (/^\d+$/.test(rawValue)) {
    return Number(rawValue);
  }

  const match = rawValue.match(/^(\d+)([smhd])$/i);

  if (!match) {
    throw new Error(`Invalid token duration: ${rawValue}`);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    d: 60 * 60 * 24,
    h: 60 * 60,
    m: 60,
    s: 1,
  };

  return value * multipliers[unit];
}

function signToken(
  payload: AuthTokenPayload,
  type: TokenType,
  expiresIn: string,
): string {
  return jwt.sign({ ...payload, type }, getJwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

function verifyToken(token: string, expectedType: TokenType): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    const { role, sid, sub, type } = decoded as Partial<SignedTokenPayload>;

    if (!isUserRole(role) || !sub || type !== expectedType) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
    }

    return { role, sid: typeof sid === "string" ? sid : undefined, sub };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
  }
}

export function signAccessToken(payload: AuthTokenPayload): string {
  return signToken(payload, "access", getJwtExpiresIn());
}

export function signRefreshToken(payload: AuthTokenPayload): string {
  return signToken(payload, "refresh", getJwtRefreshExpiresIn());
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return verifyToken(token, "access");
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return verifyToken(token, "refresh");
}

export function getAccessTokenExpiresInSeconds(): number {
  return parseDurationToSeconds(getJwtExpiresIn());
}

export function getRefreshTokenExpiresInSeconds(): number {
  return parseDurationToSeconds(getJwtRefreshExpiresIn());
}
