-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INSPECTOR');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('DRAFT', 'PENDING_INSPECTION', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ChecklistResultStatus" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'INSPECTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessEstablishment" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "tradeName" TEXT,
    "ownerName" TEXT NOT NULL,
    "taxIdentificationNumber" TEXT,
    "addressLine" TEXT NOT NULL,
    "barangay" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "contactNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEstablishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "lineOfBusiness" TEXT NOT NULL,
    "status" "PermitStatus" NOT NULL DEFAULT 'PENDING_INSPECTION',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "permitRecordId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "locationLatitude" DOUBLE PRECISION,
    "locationLongitude" DOUBLE PRECISION,
    "locationAccuracyMeters" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistResult" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "ChecklistResultStatus" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionChecklistResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checklistResultId" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "correctiveAction" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "locationLatitude" DOUBLE PRECISION,
    "locationLongitude" DOUBLE PRECISION,
    "locationAccuracyMeters" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "findingId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "locationLatitude" DOUBLE PRECISION,
    "locationLongitude" DOUBLE PRECISION,
    "locationAccuracyMeters" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BusinessEstablishment_businessName_idx" ON "BusinessEstablishment"("businessName");

-- CreateIndex
CREATE INDEX "BusinessEstablishment_barangay_city_idx" ON "BusinessEstablishment"("barangay", "city");

-- CreateIndex
CREATE UNIQUE INDEX "PermitRecord_permitNumber_key" ON "PermitRecord"("permitNumber");

-- CreateIndex
CREATE INDEX "PermitRecord_businessId_idx" ON "PermitRecord"("businessId");

-- CreateIndex
CREATE INDEX "PermitRecord_createdById_idx" ON "PermitRecord"("createdById");

-- CreateIndex
CREATE INDEX "PermitRecord_status_idx" ON "PermitRecord"("status");

-- CreateIndex
CREATE INDEX "PermitRecord_expirationDate_idx" ON "PermitRecord"("expirationDate");

-- CreateIndex
CREATE INDEX "Inspection_businessId_idx" ON "Inspection"("businessId");

-- CreateIndex
CREATE INDEX "Inspection_permitRecordId_idx" ON "Inspection"("permitRecordId");

-- CreateIndex
CREATE INDEX "Inspection_inspectorId_idx" ON "Inspection"("inspectorId");

-- CreateIndex
CREATE INDEX "Inspection_status_scheduledAt_idx" ON "Inspection"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_code_key" ON "ChecklistTemplate"("code");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_module_isActive_idx" ON "ChecklistTemplate"("module", "isActive");

-- CreateIndex
CREATE INDEX "InspectionChecklistResult_templateId_idx" ON "InspectionChecklistResult"("templateId");

-- CreateIndex
CREATE INDEX "InspectionChecklistResult_status_idx" ON "InspectionChecklistResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistResult_inspectionId_templateId_key" ON "InspectionChecklistResult"("inspectionId", "templateId");

-- CreateIndex
CREATE INDEX "Finding_inspectionId_idx" ON "Finding"("inspectionId");

-- CreateIndex
CREATE INDEX "Finding_checklistResultId_idx" ON "Finding"("checklistResultId");

-- CreateIndex
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_inspectionId_idx" ON "Attachment"("inspectionId");

-- CreateIndex
CREATE INDEX "Attachment_findingId_idx" ON "Attachment"("findingId");

-- CreateIndex
CREATE INDEX "Attachment_capturedAt_idx" ON "Attachment"("capturedAt");

-- AddForeignKey
ALTER TABLE "PermitRecord" ADD CONSTRAINT "PermitRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessEstablishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitRecord" ADD CONSTRAINT "PermitRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessEstablishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_permitRecordId_fkey" FOREIGN KEY ("permitRecordId") REFERENCES "PermitRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistResult" ADD CONSTRAINT "InspectionChecklistResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistResult" ADD CONSTRAINT "InspectionChecklistResult_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_checklistResultId_fkey" FOREIGN KEY ("checklistResultId") REFERENCES "InspectionChecklistResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
