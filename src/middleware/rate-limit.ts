import type { RequestHandler } from "express";

interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientKey(prefix: string, value: string) {
  return `${prefix}:${value}`;
}

function resolveRequestKey(requestIp: string | undefined, path: string) {
  return `${requestIp ?? "unknown"}:${path}`;
}

export function createRateLimitMiddleware({
  keyPrefix,
  limit,
  windowMs,
}: RateLimitOptions): RequestHandler {
  return (request, response, next) => {
    const now = Date.now();
    const requestKey = resolveRequestKey(request.ip, request.path);
    const storeKey = getClientKey(keyPrefix, requestKey);
    const existingEntry = rateLimitStore.get(storeKey);

    if (!existingEntry || existingEntry.resetAt <= now) {
      rateLimitStore.set(storeKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (existingEntry.count >= limit) {
      response.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((existingEntry.resetAt - now) / 1000))),
      );
      response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      });
      return;
    }

    existingEntry.count += 1;
    rateLimitStore.set(storeKey, existingEntry);
    next();
  };
}

export function resetRateLimitStoreForTests() {
  rateLimitStore.clear();
}