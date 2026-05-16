-- CreateTable
CREATE TABLE "PaymentAnomalyFlag" (
    "id"            TEXT NOT NULL,
    "paymentId"     TEXT NOT NULL,
    "reason"        TEXT NOT NULL,
    "detail"        TEXT,
    "quarantinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"    TIMESTAMP(3),
    "resolvedById"  TEXT,

    CONSTRAINT "PaymentAnomalyFlag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentAnomalyFlag"
    ADD CONSTRAINT "PaymentAnomalyFlag_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "PaymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAnomalyFlag"
    ADD CONSTRAINT "PaymentAnomalyFlag_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PaymentAnomalyFlag_paymentId_idx" ON "PaymentAnomalyFlag"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAnomalyFlag_resolvedAt_idx" ON "PaymentAnomalyFlag"("resolvedAt");

-- CreateIndex
CREATE INDEX "PaymentAnomalyFlag_quarantinedAt_idx" ON "PaymentAnomalyFlag"("quarantinedAt");
