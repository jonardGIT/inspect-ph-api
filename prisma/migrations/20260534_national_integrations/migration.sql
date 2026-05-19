-- CreateEnum
CREATE TYPE "NationalVerificationKind" AS ENUM ('PCN', 'TIN', 'DTI_NAME', 'SEC_NAME', 'LRA_PARCEL', 'DISASTER_ALERT');

-- CreateTable
CREATE TABLE "NationalVerificationRecord" (
    "id" TEXT NOT NULL,
    "kind" "NationalVerificationKind" NOT NULL,
    "referenceValue" TEXT NOT NULL,
    "businessId" TEXT,
    "requestedByUserId" TEXT,
    "result" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "providerSource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NationalVerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NationalVerificationRecord_kind_referenceValue_idx" ON "NationalVerificationRecord"("kind", "referenceValue");

-- CreateIndex
CREATE INDEX "NationalVerificationRecord_businessId_idx" ON "NationalVerificationRecord"("businessId");

-- CreateIndex
CREATE INDEX "NationalVerificationRecord_requestedByUserId_idx" ON "NationalVerificationRecord"("requestedByUserId");

-- CreateIndex
CREATE INDEX "NationalVerificationRecord_createdAt_idx" ON "NationalVerificationRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "NationalVerificationRecord" ADD CONSTRAINT "NationalVerificationRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessEstablishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationalVerificationRecord" ADD CONSTRAINT "NationalVerificationRecord_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
