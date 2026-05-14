import type { AppEnv } from "./env.js";

const WEAK_SECRET_VALUES = new Set([
  "changeme",
  "default",
  "inspect-ph",
  "secret",
  "test-secret",
]);

export function validateStartupEnv(env: AppEnv): void {
  if (
    env.nodeEnv === "production" &&
    (env.jwtSecret.length < 32 ||
      WEAK_SECRET_VALUES.has(env.jwtSecret.toLowerCase()))
  ) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters and not use a weak default value in production",
    );
  }

  if (env.authProvider === "supabase") {
    if (!env.supabaseUrl) {
      throw new Error("SUPABASE_URL is required when AUTH_PROVIDER=supabase");
    }

    if (!env.supabaseAnonKey) {
      throw new Error(
        "SUPABASE_ANON_KEY is required when AUTH_PROVIDER=supabase",
      );
    }
  }

  if (env.storageProvider === "supabase") {
    if (!env.supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is required when STORAGE_PROVIDER=supabase",
      );
    }

    if (!env.supabaseServiceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required when STORAGE_PROVIDER=supabase",
      );
    }

    if (!env.supabaseStorageBucket) {
      throw new Error(
        "SUPABASE_STORAGE_BUCKET is required when STORAGE_PROVIDER=supabase",
      );
    }
  }

  if (env.paymentProvider === "paymongo") {
    if (!env.paymongoSecretKey) {
      throw new Error(
        "PAYMONGO_SECRET_KEY is required when PAYMENT_PROVIDER=paymongo",
      );
    }

    if (!env.paymongoWebhookSecret) {
      throw new Error(
        "PAYMONGO_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=paymongo",
      );
    }
  }
}
