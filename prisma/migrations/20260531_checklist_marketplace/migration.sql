-- Migration: checklist template marketplace fields + ratings

-- Add marketplace columns to ChecklistTemplate
ALTER TABLE "ChecklistTemplate"
  ADD COLUMN "lguId"        TEXT,
  ADD COLUMN "forkedFromId" TEXT,
  ADD COLUMN "isMarketplace" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "publishedAt"  TIMESTAMPTZ;

-- Foreign key: lguId → Lgu
ALTER TABLE "ChecklistTemplate"
  ADD CONSTRAINT "ChecklistTemplate_lguId_fkey"
    FOREIGN KEY ("lguId") REFERENCES "Lgu"("id") ON DELETE SET NULL;

-- Self-referential FK: forkedFromId → ChecklistTemplate
ALTER TABLE "ChecklistTemplate"
  ADD CONSTRAINT "ChecklistTemplate_forkedFromId_fkey"
    FOREIGN KEY ("forkedFromId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL;

CREATE INDEX "ChecklistTemplate_lguId_idx"        ON "ChecklistTemplate"("lguId");
CREATE INDEX "ChecklistTemplate_isMarketplace_idx" ON "ChecklistTemplate"("isMarketplace");

-- Ratings table
CREATE TABLE "ChecklistTemplateRating" (
  "id"         TEXT         NOT NULL,
  "templateId" TEXT         NOT NULL,
  "lguId"      TEXT         NOT NULL,
  "rating"     INTEGER      NOT NULL,
  "comment"    TEXT,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "ChecklistTemplateRating_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChecklistTemplateRating_templateId_lguId_key" UNIQUE ("templateId", "lguId"),
  CONSTRAINT "ChecklistTemplateRating_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE,
  CONSTRAINT "ChecklistTemplateRating_lguId_fkey"
    FOREIGN KEY ("lguId") REFERENCES "Lgu"("id") ON DELETE CASCADE
);

CREATE INDEX "ChecklistTemplateRating_templateId_idx" ON "ChecklistTemplateRating"("templateId");
CREATE INDEX "ChecklistTemplateRating_lguId_idx"      ON "ChecklistTemplateRating"("lguId");
