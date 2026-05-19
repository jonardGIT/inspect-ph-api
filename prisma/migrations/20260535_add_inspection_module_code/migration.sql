-- AddColumn
ALTER TABLE "Inspection" ADD COLUMN "moduleCode" TEXT;

-- CreateIndex
CREATE INDEX "Inspection_moduleCode_idx" ON "Inspection"("moduleCode");
