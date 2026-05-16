-- Phase F: Public Participation and Owner Portal
-- Extend UserRole enum with BUSINESS_OWNER and CITIZEN
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BUSINESS_OWNER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CITIZEN';

-- Add businessId to User for business_owner linking
ALTER TABLE "User" ADD COLUMN "businessId" TEXT;

-- Add reporterUserId to IssueReport for authenticated citizen tracking
ALTER TABLE "IssueReport" ADD COLUMN "reporterUserId" TEXT;

-- Foreign key: User.businessId → BusinessEstablishment
ALTER TABLE "User"
  ADD CONSTRAINT "User_businessId_fkey"
  FOREIGN KEY ("businessId")
  REFERENCES "BusinessEstablishment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key: IssueReport.reporterUserId → User
ALTER TABLE "IssueReport"
  ADD CONSTRAINT "IssueReport_reporterUserId_fkey"
  FOREIGN KEY ("reporterUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "User_businessId_idx" ON "User"("businessId");
CREATE INDEX "IssueReport_reporterUserId_idx" ON "IssueReport"("reporterUserId");
