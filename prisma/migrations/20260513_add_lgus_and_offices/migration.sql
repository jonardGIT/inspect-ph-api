-- CreateTable
CREATE TABLE "Lgu" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "province" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lgu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "lguId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lguId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lgu_code_key" ON "Lgu"("code");

-- CreateIndex
CREATE INDEX "Lgu_name_idx" ON "Lgu"("name");

-- CreateIndex
CREATE INDEX "Lgu_region_province_city_idx" ON "Lgu"("region", "province", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Office_lguId_code_key" ON "Office"("lguId", "code");

-- CreateIndex
CREATE INDEX "Office_lguId_idx" ON "Office"("lguId");

-- CreateIndex
CREATE INDEX "Office_name_idx" ON "Office"("name");

-- CreateIndex
CREATE INDEX "User_lguId_idx" ON "User"("lguId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lguId_fkey" FOREIGN KEY ("lguId") REFERENCES "Lgu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_lguId_fkey" FOREIGN KEY ("lguId") REFERENCES "Lgu"("id") ON DELETE CASCADE ON UPDATE CASCADE;