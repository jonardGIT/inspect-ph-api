-- CreateEnum
CREATE TYPE "FireSafetyCertificateStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'REVOKED',
  'EXPIRED'
);

-- CreateTable
CREATE TABLE "FireSafetyCertificate" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "certificateNumber" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "FireSafetyCertificateStatus" NOT NULL DEFAULT 'DRAFT',
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FireSafetyCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FireSafetyCertificate_inspectionId_key"
ON "FireSafetyCertificate"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "FireSafetyCertificate_certificateNumber_key"
ON "FireSafetyCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "FireSafetyCertificate_status_idx"
ON "FireSafetyCertificate"("status");

-- CreateIndex
CREATE INDEX "FireSafetyCertificate_issuedAt_idx"
ON "FireSafetyCertificate"("issuedAt");

-- CreateIndex
CREATE INDEX "FireSafetyCertificate_expiresAt_idx"
ON "FireSafetyCertificate"("expiresAt");

-- AddForeignKey
ALTER TABLE "FireSafetyCertificate"
ADD CONSTRAINT "FireSafetyCertificate_inspectionId_fkey"
FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;