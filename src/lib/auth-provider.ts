import type { AppEnv, AuthProvider as AuthProviderName } from "./env.js";
import { AppError } from "./errors.js";
import {
  getAccessTokenExpiresInSeconds,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type AuthRole,
  type AuthTokenPayload,
} from "./jwt.js";

export type { AuthRole, AuthTokenPayload } from "./jwt.js";

function getConfiguredAuthProvider(): AuthProviderName {
  const normalized =
    process.env.AUTH_PROVIDER?.trim().toLowerCase() || "local-jwt";

  if (normalized !== "local-jwt" && normalized !== "supabase") {
    throw new Error("AUTH_PROVIDER must be either local-jwt or supabase");
  }

  return normalized;
}

export interface IssuedAuthTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface AuthProvider {
  issueTokens(payload: AuthTokenPayload): Promise<IssuedAuthTokens>;
  kind: AuthProviderName;
  verifyAccessToken(token: string): Promise<AuthTokenPayload>;
  verifyRefreshToken(token: string): Promise<AuthTokenPayload>;
}

class LocalJwtAuthProvider implements AuthProvider {
  kind: AuthProviderName = "local-jwt";

  async issueTokens(payload: AuthTokenPayload): Promise<IssuedAuthTokens> {
    return {
      accessToken: signAccessToken(payload),
      expiresIn: getAccessTokenExpiresInSeconds(),
      refreshToken: signRefreshToken(payload),
    };
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    return verifyAccessToken(token);
  }

  async verifyRefreshToken(token: string): Promise<AuthTokenPayload> {
    return verifyRefreshToken(token);
  }
}

class SupabaseAuthProvider implements AuthProvider {
  kind: AuthProviderName = "supabase";

  async issueTokens(): Promise<IssuedAuthTokens> {
    throw new AppError(
      501,
      "AUTH_PROVIDER_NOT_IMPLEMENTED",
      "Supabase auth provider is not implemented yet",
    );
  }

  async verifyAccessToken(): Promise<AuthTokenPayload> {
    throw new AppError(
      501,
      "AUTH_PROVIDER_NOT_IMPLEMENTED",
      "Supabase auth provider is not implemented yet",
    );
  }

  async verifyRefreshToken(): Promise<AuthTokenPayload> {
    throw new AppError(
      501,
      "AUTH_PROVIDER_NOT_IMPLEMENTED",
      "Supabase auth provider is not implemented yet",
    );
  }
}

export function getAuthProvider(
  env?: Pick<AppEnv, "authProvider">,
): AuthProvider {
  if ((env?.authProvider || getConfiguredAuthProvider()) === "supabase") {
    return new SupabaseAuthProvider();
  }

  return new LocalJwtAuthProvider();
}
