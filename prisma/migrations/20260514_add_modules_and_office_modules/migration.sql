-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeModule" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_code_key" ON "Module"("code");

-- CreateIndex
CREATE INDEX "Module_name_idx" ON "Module"("name");

-- CreateIndex
CREATE INDEX "Module_isActive_idx" ON "Module"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeModule_officeId_moduleId_key" ON "OfficeModule"("officeId", "moduleId");

-- CreateIndex
CREATE INDEX "OfficeModule_officeId_idx" ON "OfficeModule"("officeId");

-- CreateIndex
CREATE INDEX "OfficeModule_moduleId_idx" ON "OfficeModule"("moduleId");

-- AddForeignKey
ALTER TABLE "OfficeModule" ADD CONSTRAINT "OfficeModule_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeModule" ADD CONSTRAINT "OfficeModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;