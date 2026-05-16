import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

import type { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { getPaymentProvider } from "../lib/payment-provider.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";

export interface PublicPayment {
  id: string;
  referenceNumber: string;
  provider: Lowercase<`${PaymentProvider}`>;
  providerPaymentId?: string;
  amountInMinor: number;
  currency: string;
  status: Lowercase<`${PaymentStatus}`>;
  description?: string;
  checkoutUrl?: string;
  paidAt?: string;
  failedAt?: string;
  failureReason?: string;
  receiptNumber?: string;
  createdAt: string;
  updatedAt: string;
  permit: {
    id: string;
    permitNumber: string;
    business: {
      id: string;
      businessName: string;
    };
  };
}

export interface CreatePaymentInput {
  amountInMinor: number;
  currency?: string;
  description?: string;
  permitId: string;
}

export interface ListPaymentsInput {
  limit: number;
  page: number;
  permitId?: string;
  provider?: PaymentProvider;
  skip: number;
  status?: PaymentStatus;
}

type PaymentRecordWithPermit = Prisma.PaymentRecordGetPayload<{
  include: {
    permitRecord: {
      include: {
        business: {
          select: {
            businessName: true;
            id: true;
          };
        };
      };
    };
  };
}>;

function createPaymentReferenceNumber() {
  const date = new Date();
  const dateSegment = `${date.getUTCFullYear()}${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;

  return `PAY-${dateSegment}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function generateReceiptNumber(): string {
  const date = new Date();
  const dateSegment = `${date.getUTCFullYear()}${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;

  return `OR-${dateSegment}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function toPublicPayment(record: PaymentRecordWithPermit): PublicPayment {
  return {
    amountInMinor: record.amountInMinor,
    checkoutUrl: record.checkoutUrl ?? undefined,
    createdAt: record.createdAt.toISOString(),
    currency: record.currency,
    description: record.description ?? undefined,
    failedAt: record.failedAt?.toISOString(),
    failureReason: record.failureReason ?? undefined,
    id: record.id,
    paidAt: record.paidAt?.toISOString(),
    receiptNumber: record.receiptNumber ?? undefined,
    permit: {
      business: {
        businessName: record.permitRecord.business.businessName,
        id: record.permitRecord.business.id,
      },
      id: record.permitRecord.id,
      permitNumber: record.permitRecord.permitNumber,
    },
    provider: record.provider.toLowerCase() as Lowercase<`${PaymentProvider}`>,
    providerPaymentId: record.providerPaymentId ?? undefined,
    referenceNumber: record.referenceNumber,
    status: record.status.toLowerCase() as Lowercase<`${PaymentStatus}`>,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildPaymentWhere(
  input: ListPaymentsInput,
): Prisma.PaymentRecordWhereInput {
  return {
    ...(input.permitId ? { permitRecordId: input.permitId } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
}

export async function listPayments(input: ListPaymentsInput): Promise<{
  data: PublicPayment[];
  meta: { limit: number; page: number; total: number };
}> {
  const where = buildPaymentWhere(input);
  const [total, records] = await Promise.all([
    prisma.paymentRecord.count({ where }),
    prisma.paymentRecord.findMany({
      include: {
        permitRecord: {
          include: {
            business: {
              select: {
                businessName: true,
                id: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: records.map(toPublicPayment),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function createPayment(
  input: CreatePaymentInput,
): Promise<PublicPayment> {
  const permit = await prisma.permitRecord.findUnique({
    include: {
      business: {
        select: {
          businessName: true,
          id: true,
        },
      },
    },
    where: { id: input.permitId },
  });

  if (!permit) {
    throw new AppError(404, "PERMIT_NOT_FOUND", "Permit record not found");
  }

  const provider = getPaymentProvider();
  const created = await prisma.paymentRecord.create({
    data: {
      amountInMinor: input.amountInMinor,
      currency: input.currency?.trim().toUpperCase() || "PHP",
      description: input.description?.trim() || null,
      permitRecordId: input.permitId,
      provider: provider.kind.toUpperCase() as PaymentProvider,
      referenceNumber: createPaymentReferenceNumber(),
      status: "PENDING",
    },
    include: {
      permitRecord: {
        include: {
          business: {
            select: {
              businessName: true,
              id: true,
            },
          },
        },
      },
    },
  });

  const checkout = await provider.createCheckoutSession({
    amountInMinor: created.amountInMinor,
    currency: created.currency,
    description:
      created.description ||
      `Permit ${created.permitRecord.permitNumber} payment`,
    paymentId: created.id,
    referenceNumber: created.referenceNumber,
  });

  const updated = await prisma.paymentRecord.update({
    data: {
      checkoutUrl: checkout.checkoutUrl,
      providerPaymentId: checkout.providerPaymentId,
      status: checkout.initialStatus.toUpperCase() as PaymentStatus,
    },
    include: {
      permitRecord: {
        include: {
          business: {
            select: {
              businessName: true,
              id: true,
            },
          },
        },
      },
    },
    where: { id: created.id },
  });

  return toPublicPayment(updated);
}

export async function getPublicPaymentByReferenceNumber(input: {
  referenceNumber: string;
}): Promise<PublicPayment> {
  const payment = await prisma.paymentRecord.findUnique({
    include: {
      permitRecord: {
        include: {
          business: {
            select: {
              businessName: true,
              id: true,
            },
          },
        },
      },
    },
    where: { referenceNumber: input.referenceNumber },
  });

  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }

  return toPublicPayment(payment);
}

export async function processPaymentWebhook(input: {
  body: unknown;
  headers: IncomingHttpHeaders;
}): Promise<PublicPayment> {
  const provider = getPaymentProvider();
  const event = await provider.parseWebhookEvent({
    body: input.body,
    headers: input.headers,
  });

  // Idempotency: skip already-processed events
  if (event.eventId) {
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId: event.eventId },
    });
    if (alreadyProcessed) {
      // Return the current payment state without reprocessing
      const payment = await prisma.paymentRecord.findUnique({
        include: {
          permitRecord: {
            include: { business: { select: { businessName: true, id: true } } },
          },
        },
        where: { providerPaymentId: event.providerPaymentId },
      });
      if (!payment) {
        throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
      }
      return toPublicPayment(payment);
    }
  }

  const existing = await prisma.paymentRecord.findUnique({
    include: {
      permitRecord: {
        include: {
          business: {
            select: {
              businessName: true,
              id: true,
            },
          },
        },
      },
    },
    where: { providerPaymentId: event.providerPaymentId },
  });

  if (!existing) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }

  const now = new Date();
  const updated = await prisma.paymentRecord.update({
    data: {
      failedAt: event.status === "failed" ? now : null,
      failureReason:
        event.status === "failed" ? event.failureReason || null : null,
      paidAt: event.status === "paid" ? now : null,
      receiptNumber:
        event.status === "paid" && !existing.receiptNumber
          ? generateReceiptNumber()
          : existing.receiptNumber,
      status: event.status.toUpperCase() as PaymentStatus,
    },
    include: {
      permitRecord: {
        include: {
          business: {
            select: {
              businessName: true,
              id: true,
            },
          },
        },
      },
    },
    where: { id: existing.id },
  });

  await recordAuditLog({
    action: "payment.status_updated",
    entityId: updated.id,
    entityType: "payment",
    summary: `Payment ${updated.referenceNumber} transitioned to ${event.status} via webhook`,
    detail: event.providerPaymentId,
  });

  // Record the event ID so replays are ignored
  if (event.eventId) {
    await prisma.processedWebhookEvent.create({
      data: { eventId: event.eventId },
    });
  }

  return toPublicPayment(updated);
}

export async function getPaymentReceipt(paymentId: string): Promise<string> {
  const record = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: {
      permitRecord: {
        include: {
          business: {
            select: { businessName: true, id: true },
          },
        },
      },
    },
  });

  if (!record) {
    throw new AppError(404, "NOT_FOUND", "Payment not found");
  }

  if (record.status !== "PAID" || !record.receiptNumber) {
    throw new AppError(
      400,
      "PAYMENT_NOT_PAID",
      "Receipt is only available for paid payments",
    );
  }

  const paidDate =
    record.paidAt?.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) ?? "—";

  const amount = (record.amountInMinor / 100).toLocaleString("en-PH", {
    style: "currency",
    currency: record.currency,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Official Receipt — ${record.receiptNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #111; font-size: 14px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
    .header h2 { margin: 4px 0; }
    .field { margin: 8px 0; display: flex; gap: 8px; }
    .field label { font-weight: bold; min-width: 180px; }
    .amount { font-size: 1.3em; font-weight: bold; margin: 16px 0; }
    .footer { margin-top: 48px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 0.85em; color: #555; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h2>Republic of the Philippines</h2>
    <h2>Official Receipt</h2>
  </div>
  <div class="field"><label>OR Number:</label> <span>${record.receiptNumber}</span></div>
  <div class="field"><label>Reference No.:</label> <span>${record.referenceNumber}</span></div>
  <div class="field"><label>Business:</label> <span>${record.permitRecord.business.businessName}</span></div>
  <div class="field"><label>Permit No.:</label> <span>${record.permitRecord.permitNumber}</span></div>
  <div class="field"><label>Date Paid:</label> <span>${paidDate}</span></div>
  ${record.description ? `<div class="field"><label>Description:</label> <span>${record.description}</span></div>` : ""}
  <div class="amount">Amount: ${amount}</div>
  <div class="footer">
    <p>This is a computer-generated official receipt. No signature required.</p>
  </div>
</body>
</html>`;
}
