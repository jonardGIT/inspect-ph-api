CREATE TYPE "PaymentProvider" AS ENUM ('LOCAL', 'PAYMONGO');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED');

CREATE TABLE "PaymentRecord" (
  "id" TEXT NOT NULL,
  "permitRecordId" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'LOCAL',
  "providerPaymentId" TEXT,
  "amountInMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "description" TEXT,
  "checkoutUrl" TEXT,
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRecord_referenceNumber_key" ON "PaymentRecord"("referenceNumber");
CREATE UNIQUE INDEX "PaymentRecord_providerPaymentId_key" ON "PaymentRecord"("providerPaymentId");
CREATE INDEX "PaymentRecord_permitRecordId_idx" ON "PaymentRecord"("permitRecordId");
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");
CREATE INDEX "PaymentRecord_provider_idx" ON "PaymentRecord"("provider");
CREATE INDEX "PaymentRecord_createdAt_idx" ON "PaymentRecord"("createdAt");

ALTER TABLE "PaymentRecord"
ADD CONSTRAINT "PaymentRecord_permitRecordId_fkey"
FOREIGN KEY ("permitRecordId") REFERENCES "PermitRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add receiptNumber and drop DEFAULT on updatedAt (set by add_finding_dispute)
ALTER TABLE "PaymentRecord" ADD COLUMN "receiptNumber" TEXT;
ALTER TABLE "PaymentRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;
CREATE UNIQUE INDEX "PaymentRecord_receiptNumber_key" ON "PaymentRecord"("receiptNumber");