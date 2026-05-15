-- Add archivedAt soft-delete field to administrative resource models
ALTER TABLE "Lgu" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Office" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Module" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "BusinessEstablishment" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "PermitRecord" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Lgu_archivedAt_idx" ON "Lgu"("archivedAt");
CREATE INDEX "Office_archivedAt_idx" ON "Office"("archivedAt");
CREATE INDEX "Module_archivedAt_idx" ON "Module"("archivedAt");
CREATE INDEX "BusinessEstablishment_archivedAt_idx" ON "BusinessEstablishment"("archivedAt");
CREATE INDEX "PermitRecord_archivedAt_idx" ON "PermitRecord"("archivedAt");
