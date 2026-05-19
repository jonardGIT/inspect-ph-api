import "../env.js";

import { prisma } from "../lib/prisma.js";

// References the permit created by seed-dev-inspections
const DEV_PERMIT_ID = "dc206a56-2ec0-48d0-9d33-e51a1e308cf9";

const DEV_PAYMENT_PAID_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const DEV_PAYMENT_PENDING_ID = "a1b2c3d4-0002-4000-8000-000000000002";
const DEV_PAYMENT_FAILED_ID = "a1b2c3d4-0003-4000-8000-000000000003";

async function main() {
  const permit = await prisma.permitRecord.findUnique({
    where: { id: DEV_PERMIT_ID },
  });

  if (!permit) {
    throw new Error(
      "Dev permit was not found. Run npm run seed:dev-inspections first.",
    );
  }

  const paid = await prisma.paymentRecord.upsert({
    where: { id: DEV_PAYMENT_PAID_ID },
    update: {
      amountInMinor: 150000,
      currency: "PHP",
      description: "Business permit application fee — 2026 renewal",
      paidAt: new Date("2026-05-05T09:15:00.000Z"),
      provider: "LOCAL",
      receiptNumber: "OR-DEV-2026-0001",
      referenceNumber: "PAY-DEV-2026-0001",
      status: "PAID",
    },
    create: {
      id: DEV_PAYMENT_PAID_ID,
      amountInMinor: 150000,
      currency: "PHP",
      description: "Business permit application fee — 2026 renewal",
      paidAt: new Date("2026-05-05T09:15:00.000Z"),
      permitRecordId: permit.id,
      provider: "LOCAL",
      receiptNumber: "OR-DEV-2026-0001",
      referenceNumber: "PAY-DEV-2026-0001",
      status: "PAID",
    },
  });

  const pending = await prisma.paymentRecord.upsert({
    where: { id: DEV_PAYMENT_PENDING_ID },
    update: {
      amountInMinor: 75000,
      currency: "PHP",
      description: "Fire safety certificate levy",
      provider: "PAYMONGO",
      referenceNumber: "PAY-DEV-2026-0002",
      status: "PENDING",
    },
    create: {
      id: DEV_PAYMENT_PENDING_ID,
      amountInMinor: 75000,
      currency: "PHP",
      description: "Fire safety certificate levy",
      permitRecordId: permit.id,
      provider: "PAYMONGO",
      referenceNumber: "PAY-DEV-2026-0002",
      status: "PENDING",
    },
  });

  const failed = await prisma.paymentRecord.upsert({
    where: { id: DEV_PAYMENT_FAILED_ID },
    update: {
      amountInMinor: 25000,
      currency: "PHP",
      description: "Sanitation inspection surcharge",
      failedAt: new Date("2026-05-03T14:22:00.000Z"),
      failureReason: "Card declined by issuing bank",
      provider: "PAYMONGO",
      referenceNumber: "PAY-DEV-2026-0003",
      status: "FAILED",
    },
    create: {
      id: DEV_PAYMENT_FAILED_ID,
      amountInMinor: 25000,
      currency: "PHP",
      description: "Sanitation inspection surcharge",
      failedAt: new Date("2026-05-03T14:22:00.000Z"),
      failureReason: "Card declined by issuing bank",
      permitRecordId: permit.id,
      provider: "PAYMONGO",
      referenceNumber: "PAY-DEV-2026-0003",
      status: "FAILED",
    },
  });

  console.log(
    JSON.stringify(
      {
        payments: [
          {
            id: paid.id,
            amountPhp: paid.amountInMinor / 100,
            referenceNumber: paid.referenceNumber,
            status: paid.status,
          },
          {
            id: pending.id,
            amountPhp: pending.amountInMinor / 100,
            referenceNumber: pending.referenceNumber,
            status: pending.status,
          },
          {
            id: failed.id,
            amountPhp: failed.amountInMinor / 100,
            referenceNumber: failed.referenceNumber,
            status: failed.status,
          },
        ],
        permitId: permit.id,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
