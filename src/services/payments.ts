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

  return toPublicPayment(updated);
}
