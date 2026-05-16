import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { recordAuditLog } from "./audit-logs.js";

export type OutboundWebhookEvent =
  | "inspection.completed"
  | "finding.raised"
  | "certificate.issued"
  | "payment.received";

export interface WebhookEndpointInput {
  lguId: string;
  url: string;
  secret: string;
  events: OutboundWebhookEvent[];
  actorUserId: string;
}

// ─── Endpoint CRUD ────────────────────────────────────────────────────────────

export async function registerWebhookEndpoint(input: WebhookEndpointInput) {
  const endpoint = await prisma.lguWebhookEndpoint.create({
    data: {
      lguId: input.lguId,
      url: input.url.trim(),
      secret: input.secret,
      events: input.events,
    },
  });

  await recordAuditLog({
    action: "webhook_endpoint.created",
    actorUserId: input.actorUserId,
    entityId: endpoint.id,
    entityType: "webhook_endpoint",
    summary: `Registered webhook endpoint ${endpoint.url} for LGU ${input.lguId}`,
  });

  return endpoint;
}

export async function listWebhookEndpoints(lguId: string) {
  return prisma.lguWebhookEndpoint.findMany({
    where: { lguId },
    select: {
      id: true,
      lguId: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      // Never return secret
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteWebhookEndpoint(
  id: string,
  lguId: string,
  actorUserId: string,
): Promise<void> {
  const endpoint = await prisma.lguWebhookEndpoint.findFirst({
    where: { id, lguId },
  });

  if (!endpoint) {
    throw new AppError(
      404,
      "WEBHOOK_ENDPOINT_NOT_FOUND",
      "Webhook endpoint not found",
    );
  }

  await prisma.lguWebhookEndpoint.delete({ where: { id } });

  await recordAuditLog({
    action: "webhook_endpoint.deleted",
    actorUserId,
    entityId: id,
    entityType: "webhook_endpoint",
    summary: `Deleted webhook endpoint ${endpoint.url} for LGU ${lguId}`,
  });
}

// ─── Event dispatch ──────────────────────────────────────────────────────────

/**
 * Enqueue and fire outbound webhook events for all active endpoints subscribed
 * to `event` for the given `lguId`. Fire-and-forget: never throws.
 */
export async function enqueueWebhookEvent(
  lguId: string,
  event: OutboundWebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const endpoints = await prisma.lguWebhookEndpoint.findMany({
      where: {
        lguId,
        isActive: true,
        events: { has: event },
      },
    });

    if (endpoints.length === 0) return;

    await Promise.allSettled(
      endpoints.map((endpoint) =>
        deliverToEndpoint(
          endpoint.id,
          endpoint.url,
          endpoint.secret,
          event,
          payload,
        ),
      ),
    );
  } catch {
    // Webhook delivery must never break the primary request path
  }
}

async function deliverToEndpoint(
  endpointId: string,
  url: string,
  secret: string,
  event: OutboundWebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify({
    event,
    payload,
    deliveredAt: new Date().toISOString(),
  });
  const signature = computeSignature(secret, body);

  let statusCode: number | null = null;
  let success = false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-InspectPH-Signature": `sha256=${signature}`,
        "X-InspectPH-Event": event,
        "User-Agent": "InspectPH-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    statusCode = response.status;
    success = response.status >= 200 && response.status < 300;
  } catch {
    // Network failure — record with no statusCode
  }

  await prisma.webhookDelivery.create({
    data: {
      endpointId,
      event,
      payload: payload as object,
      statusCode,
      success,
      nextRetryAt: success ? null : new Date(Date.now() + 5 * 60_000),
    },
  });
}

function computeSignature(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
