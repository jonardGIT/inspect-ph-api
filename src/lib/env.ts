const DEFAULT_PORT = 4000;
const DEFAULT_JWT_EXPIRES_IN = "15m";
const DEFAULT_JWT_REFRESH_EXPIRES_IN = "7d";
const DEFAULT_BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_PUBLIC_API_URL = "http://localhost:4000";
const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 365;
const DEFAULT_NOTIFICATION_RETENTION_DAYS = 90;

export type StorageProvider = "local" | "supabase";
export type AuthProvider = "local-jwt" | "supabase";
export type PaymentProvider = "local" | "paymongo";

export interface AppEnv {
  auditLogRetentionDays: number;
  authProvider: AuthProvider;
  bcryptSaltRounds: number;
  databaseUrl: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  jwtSecret: string;
  nodeEnv: string;
  notificationRetentionDays: number;
  paymentProvider: PaymentProvider;
  paymongoSecretKey?: string;
  paymongoWebhookSecret?: string;
  uploadsDir: string;
  port: number;
  publicApiUrl: string;
  sentryDsn?: string;
  supabaseAnonKey?: string;
  storageProvider: StorageProvider;
  supabaseServiceRoleKey?: string;
  supabaseStorageBucket?: string;
  supabaseUrl?: string;
}

function parseDuration(
  rawValue: string | undefined,
  fallback: string,
  name: string,
): string {
  const value = rawValue?.trim() || fallback;

  if (!/^\d+[smhd]$/i.test(value) && !/^\d+$/.test(value)) {
    throw new Error(
      `${name} must be a number of seconds or a duration such as 15m, 1h, or 7d`,
    );
  }

  return value;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallback: number,
  name: string,
): number {
  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function parseStorageProvider(rawValue: string | undefined): StorageProvider {
  const normalized = rawValue?.trim().toLowerCase() || "local";

  if (normalized !== "local" && normalized !== "supabase") {
    throw new Error("STORAGE_PROVIDER must be either local or supabase");
  }

  return normalized;
}

function parseAuthProvider(rawValue: string | undefined): AuthProvider {
  const normalized = rawValue?.trim().toLowerCase() || "local-jwt";

  if (normalized !== "local-jwt" && normalized !== "supabase") {
    throw new Error("AUTH_PROVIDER must be either local-jwt or supabase");
  }

  return normalized;
}

function parsePaymentProvider(rawValue: string | undefined): PaymentProvider {
  const normalized = rawValue?.trim().toLowerCase() || "local";

  if (normalized !== "local" && normalized !== "paymongo") {
    throw new Error("PAYMENT_PROVIDER must be either local or paymongo");
  }

  return normalized;
}

function parseOptionalUrl(
  rawValue: string | undefined,
  name: string,
): string | undefined {
  const value = rawValue?.trim();

  if (!value) {
    return undefined;
  }

  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  return value;
}

export function loadEnv(): AppEnv {
  const port = parsePositiveInteger(process.env.PORT, DEFAULT_PORT, "PORT");

  return {
    auditLogRetentionDays: parsePositiveInteger(
      process.env.AUDIT_LOG_RETENTION_DAYS,
      DEFAULT_AUDIT_LOG_RETENTION_DAYS,
      "AUDIT_LOG_RETENTION_DAYS",
    ),
    authProvider: parseAuthProvider(process.env.AUTH_PROVIDER),
    bcryptSaltRounds: parsePositiveInteger(
      process.env.BCRYPT_SALT_ROUNDS,
      DEFAULT_BCRYPT_SALT_ROUNDS,
      "BCRYPT_SALT_ROUNDS",
    ),
    databaseUrl: requireEnv("DATABASE_URL"),
    jwtExpiresIn: parseDuration(
      process.env.JWT_EXPIRES_IN,
      DEFAULT_JWT_EXPIRES_IN,
      "JWT_EXPIRES_IN",
    ),
    jwtRefreshExpiresIn: parseDuration(
      process.env.JWT_REFRESH_EXPIRES_IN,
      DEFAULT_JWT_REFRESH_EXPIRES_IN,
      "JWT_REFRESH_EXPIRES_IN",
    ),
    jwtSecret: requireEnv("JWT_SECRET"),
    nodeEnv: process.env.NODE_ENV?.trim() || "development",
    notificationRetentionDays: parsePositiveInteger(
      process.env.NOTIFICATION_RETENTION_DAYS,
      DEFAULT_NOTIFICATION_RETENTION_DAYS,
      "NOTIFICATION_RETENTION_DAYS",
    ),
    paymentProvider: parsePaymentProvider(process.env.PAYMENT_PROVIDER),
    paymongoSecretKey: process.env.PAYMONGO_SECRET_KEY?.trim() || undefined,
    paymongoWebhookSecret:
      process.env.PAYMONGO_WEBHOOK_SECRET?.trim() || undefined,
    uploadsDir: process.env.UPLOADS_DIR?.trim() || "uploads",
    port,
    publicApiUrl:
      parseOptionalUrl(process.env.PUBLIC_API_URL, "PUBLIC_API_URL") ??
      DEFAULT_PUBLIC_API_URL.replace("4000", String(port)),
    sentryDsn: process.env.SENTRY_DSN?.trim() || undefined,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY?.trim() || undefined,
    storageProvider: parseStorageProvider(process.env.STORAGE_PROVIDER),
    supabaseServiceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
    supabaseStorageBucket:
      process.env.SUPABASE_STORAGE_BUCKET?.trim() || undefined,
    supabaseUrl: parseOptionalUrl(process.env.SUPABASE_URL, "SUPABASE_URL"),
  };
}
