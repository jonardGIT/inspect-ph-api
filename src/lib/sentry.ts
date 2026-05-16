import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(dsn?: string): void {
  if (!dsn || initialized) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  });

  initialized = true;
}

export { Sentry };
