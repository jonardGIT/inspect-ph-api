-- AddColumn
ALTER TABLE "Inspection" ADD COLUMN "officeId" TEXT;

-- Backfill office from assigned inspector where an office assignment exists
UPDATE "Inspection" AS i
SET "officeId" = uoa."officeId"
FROM "UserOfficeAssignment" AS uoa
WHERE i."inspectorId" = uoa."userId"
  AND i."officeId" IS NULL;

-- Backfill remaining rows to the first available office for existing seed/dev data
UPDATE "Inspection"
SET "officeId" = (
  SELECT o."id"
  FROM "Office" AS o
  ORDER BY o."createdAt" ASC
  LIMIT 1
)
WHERE "officeId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Inspection"
    WHERE "officeId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot backfill Inspection.officeId because no office is available for one or more legacy inspections. Seed an LGU and office first, then rerun the migration or manually populate Inspection.officeId before setting the column NOT NULL.';
  END IF;
END $$;

ALTER TABLE "Inspection"
ALTER COLUMN "officeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Inspection_officeId_idx" ON "Inspection"("officeId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
