import type { IncomingHttpHeaders } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

import type { AppEnv, PaymentProvider as PaymentProviderName } from "./env.js";
import { loadEnv } from "./env.js";
import { AppError } from "./errors.js";

export interface CreatePaymentCheckoutInput {
  amountInMinor: number;
  currency: string;
  description: string;
  paymentId: string;
  referenceNumber: string;
}

export interface PaymentCheckoutSession {
  checkoutUrl: string;
  initialStatus: "pending" | "processing";
  provider: PaymentProviderName;
  providerPaymentId: string;
}

export interface PaymentWebhookEvent {
  failureReason?: string;
  providerPaymentId: string;
  status: "processing" | "paid" | "failed";
}

export interface PaymentProvider {
  createCheckoutSession(
    input: CreatePaymentCheckoutInput,
  ): Promise<PaymentCheckoutSession>;
  kind: PaymentProviderName;
  parseWebhookEvent(input: {
    body: unknown;
    headers: IncomingHttpHeaders;
  }): Promise<PaymentWebhookEvent>;
}

class LocalPaymentProvider implements PaymentProvider {
  kind: PaymentProviderName = "local";

  constructor(private readonly env: AppEnv) {}

  async createCheckoutSession(
    input: CreatePaymentCheckoutInput,
  ): Promise<PaymentCheckoutSession> {
    const providerPaymentId = `local_${input.paymentId}`;

    return {
      checkoutUrl: `${this.env.publicApiUrl}/api/v1/payments/public/${input.referenceNumber}`,
      initialStatus: "processing",
      provider: "local",
      providerPaymentId,
    };
  }

  async parseWebhookEvent(input: {
    body: unknown;
    headers: IncomingHttpHeaders;
  }): Promise<PaymentWebhookEvent> {
    const body = input.body;

    if (!body || typeof body !== "object") {
      throw new AppError(
        400,
        "INVALID_WEBHOOK_PAYLOAD",
        "Webhook payload is invalid",
      );
    }

    const providerPaymentId =
      "providerPaymentId" in body && typeof body.providerPaymentId === "string"
        ? body.providerPaymentId.trim()
        : "";
    const status =
      "status" in body && typeof body.status === "string"
        ? body.status.trim().toLowerCase()
        : "";

    if (!providerPaymentId) {
      throw new AppError(
        400,
        "INVALID_WEBHOOK_PAYLOAD",
        "providerPaymentId is required",
      );
    }

    if (status !== "processing" && status !== "paid" && status !== "failed") {
      throw new AppError(
        400,
        "INVALID_WEBHOOK_PAYLOAD",
        "status must be processing, paid, or failed",
      );
    }

    const failureReason =
      "failureReason" in body && typeof body.failureReason === "string"
        ? body.failureReason.trim() || undefined
        : undefined;

    return {
      failureReason,
      providerPaymentId,
      status,
    };
  }
}

class PaymongoPaymentProvider implements PaymentProvider {
  kind: PaymentProviderName = "paymongo";

  constructor(private readonly env: AppEnv) {}

  async createCheckoutSession(): Promise<PaymentCheckoutSession> {
    throw new AppError(
      501,
      "PAYMENT_PROVIDER_NOT_IMPLEMENTED",
      "PayMongo checkout is not implemented yet",
    );
  }

  async parseWebhookEvent(input: {
    body: unknown;
    headers: IncomingHttpHeaders;
  }): Promise<PaymentWebhookEvent> {
    const webhookSecret = this.env.paymongoWebhookSecret;

    if (!webhookSecret) {
      throw new AppError(
        500,
        "PAYMENT_CONFIG_ERROR",
        "PayMongo webhook secret is not configured",
      );
    }

    // PayMongo sends the raw JSON body as a string and signs it
    const rawBody =
      typeof input.body === "string" ? input.body : JSON.stringify(input.body);

    const signature = input.headers["paymongo-signature"];
    if (typeof signature !== "string" || !signature) {
      throw new AppError(
        400,
        "WEBHOOK_SIGNATURE_MISSING",
        "PayMongo signature header is missing",
      );
    }

    // PayMongo signature format: "t=<timestamp>,v1=<hmac>"
    const parts: Record<string, string> = {};
    for (const part of signature.split(",")) {
      const [key, value] = part.split("=");
      if (key && value !== undefined) {
        parts[key] = value;
      }
    }

    const timestamp = parts["t"];
    const receivedHmac = parts["v1"];

    if (!timestamp || !receivedHmac) {
      throw new AppError(
        400,
        "WEBHOOK_SIGNATURE_INVALID",
        "PayMongo signature header is malformed",
      );
    }

    const payload = `${timestamp}.${rawBody}`;
    const expectedHmac = createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedHmac, "utf8");
    const receivedBuffer = Buffer.from(receivedHmac, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new AppError(
        400,
        "WEBHOOK_SIGNATURE_MISMATCH",
        "PayMongo webhook signature verification failed",
      );
    }

    // Parse the PayMongo event payload
    const event =
      typeof input.body === "string"
        ? (JSON.parse(input.body) as unknown)
        : input.body;

    if (
      !event ||
      typeof event !== "object" ||
      !("data" in event) ||
      !event.data ||
      typeof event.data !== "object"
    ) {
      throw new AppError(
        400,
        "INVALID_WEBHOOK_PAYLOAD",
        "Unexpected PayMongo event shape",
      );
    }

    const data = event.data as Record<string, unknown>;
    const attributes = (
      data.attributes && typeof data.attributes === "object"
        ? data.attributes
        : {}
    ) as Record<string, unknown>;

    const eventType =
      typeof attributes.type === "string" ? attributes.type : "";

    const dataAttributes = (
      attributes.data &&
      typeof attributes.data === "object" &&
      "attributes" in (attributes.data as object)
        ? (attributes.data as Record<string, unknown>).attributes
        : {}
    ) as Record<string, unknown>;

    const providerPaymentId =
      typeof dataAttributes.id === "string"
        ? dataAttributes.id
        : typeof data.id === "string"
          ? data.id
          : "";

    if (!providerPaymentId) {
      throw new AppError(
        400,
        "INVALID_WEBHOOK_PAYLOAD",
        "Cannot resolve providerPaymentId from PayMongo event",
      );
    }

    // Map PayMongo event types to local status
    let status: PaymentWebhookEvent["status"];

    if (
      eventType === "payment.paid" ||
      eventType === "link.payment.paid" ||
      eventType === "checkout_session.payment.paid"
    ) {
      status = "paid";
    } else if (
      eventType === "payment.failed" ||
      eventType === "link.payment.failed" ||
      eventType === "checkout_session.payment.expired"
    ) {
      status = "failed";
    } else {
      status = "processing";
    }

    const failureReason =
      typeof dataAttributes.last_payment_error === "string" &&
      dataAttributes.last_payment_error
        ? dataAttributes.last_payment_error
        : typeof dataAttributes.description === "string" &&
            dataAttributes.description &&
            status === "failed"
          ? dataAttributes.description
          : undefined;

    return {
      failureReason,
      providerPaymentId,
      status,
    };
  }
}

export function getPaymentProvider(env?: AppEnv): PaymentProvider {
  const resolvedEnv = env ?? loadEnv();

  if (resolvedEnv.paymentProvider === "paymongo") {
    return new PaymongoPaymentProvider(resolvedEnv);
  }

  return new LocalPaymentProvider(resolvedEnv);
}
