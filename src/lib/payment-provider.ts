import type { IncomingHttpHeaders } from "node:http";

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

  async createCheckoutSession(): Promise<PaymentCheckoutSession> {
    throw new AppError(
      501,
      "PAYMENT_PROVIDER_NOT_IMPLEMENTED",
      "PayMongo payment provider is not implemented yet",
    );
  }

  async parseWebhookEvent(): Promise<PaymentWebhookEvent> {
    throw new AppError(
      501,
      "PAYMENT_PROVIDER_NOT_IMPLEMENTED",
      "PayMongo payment provider is not implemented yet",
    );
  }
}

export function getPaymentProvider(env?: AppEnv): PaymentProvider {
  const resolvedEnv = env ?? loadEnv();

  if (resolvedEnv.paymentProvider === "paymongo") {
    return new PaymongoPaymentProvider();
  }

  return new LocalPaymentProvider(resolvedEnv);
}
