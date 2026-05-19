CREATE TYPE "IssueReportCategory" AS ENUM (
  'FIRE_HAZARD',
  'SANITATION',
  'STRUCTURAL',
  'PUBLIC_SAFETY',
  'OTHER'
);

CREATE TYPE "IssueReportStatus" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED'
);

CREATE TABLE "IssueReport" (
  "id" TEXT NOT NULL,
  "reportNumber" TEXT NOT NULL,
  "category" "IssueReportCategory" NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "locationDescription" TEXT,
  "reporterName" TEXT,
  "reporterEmail" TEXT,
  "reporterPhone" TEXT,
  "locationLatitude" DOUBLE PRECISION,
  "locationLongitude" DOUBLE PRECISION,
  "locationAccuracyMeters" DOUBLE PRECISION,
  "status" "IssueReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssueReport_reportNumber_key" ON "IssueReport"("reportNumber");
CREATE INDEX "IssueReport_category_idx" ON "IssueReport"("category");
CREATE INDEX "IssueReport_status_idx" ON "IssueReport"("status");
CREATE INDEX "IssueReport_createdAt_idx" ON "IssueReport"("createdAt");

-- Drop DEFAULT on updatedAt (set by add_finding_dispute)
ALTER TABLE "IssueReport" ALTER COLUMN "updatedAt" DROP DEFAULT;