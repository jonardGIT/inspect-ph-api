/*
  Warnings:

  - A unique constraint covering the columns `[receiptNumber]` on the table `PaymentRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FindingDisputeStatus" AS ENUM ('PENDING', 'REVIEWING', 'UPHELD', 'OVERTURNED');

-- CreateEnum
CREATE TYPE "CapStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED');

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'PUSH';

-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "FireSafetyCertificate" ADD COLUMN     "verificationUrl" TEXT;

-- AlterTable
ALTER TABLE "InspectionChecklistResult" ADD COLUMN     "templateSnapshot" JSONB,
ADD COLUMN     "templateVersion" INTEGER;

-- AlterTable
ALTER TABLE "IssueReport" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentRecord" ADD COLUMN     "receiptNumber" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CorrectiveActionPlan" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "status" "CapStatus" NOT NULL DEFAULT 'OPEN',
    "responseNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingDispute" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "disputedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FindingDisputeStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindingDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveActionPlan_findingId_key" ON "CorrectiveActionPlan"("findingId");

-- CreateIndex
CREATE INDEX "CorrectiveActionPlan_inspectionId_idx" ON "CorrectiveActionPlan"("inspectionId");

-- CreateIndex
CREATE INDEX "CorrectiveActionPlan_businessId_idx" ON "CorrectiveActionPlan"("businessId");

-- CreateIndex
CREATE INDEX "CorrectiveActionPlan_status_idx" ON "CorrectiveActionPlan"("status");

-- CreateIndex
CREATE INDEX "CorrectiveActionPlan_deadlineAt_idx" ON "CorrectiveActionPlan"("deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "FindingDispute_findingId_key" ON "FindingDispute"("findingId");

-- CreateIndex
CREATE INDEX "FindingDispute_findingId_idx" ON "FindingDispute"("findingId");

-- CreateIndex
CREATE INDEX "FindingDispute_status_idx" ON "FindingDispute"("status");

-- CreateIndex
CREATE INDEX "FindingDispute_disputedByUserId_idx" ON "FindingDispute"("disputedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_receiptNumber_key" ON "PaymentRecord"("receiptNumber");

-- AddForeignKey
ALTER TABLE "CorrectiveActionPlan" ADD CONSTRAINT "CorrectiveActionPlan_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveActionPlan" ADD CONSTRAINT "CorrectiveActionPlan_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveActionPlan" ADD CONSTRAINT "CorrectiveActionPlan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessEstablishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingDispute" ADD CONSTRAINT "FindingDispute_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingDispute" ADD CONSTRAINT "FindingDispute_disputedByUserId_fkey" FOREIGN KEY ("disputedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingDispute" ADD CONSTRAINT "FindingDispute_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
