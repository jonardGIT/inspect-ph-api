-- CreateTable
CREATE TABLE "UserOfficeAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOfficeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOfficeAssignment_userId_officeId_key" ON "UserOfficeAssignment"("userId", "officeId");

-- CreateIndex
CREATE INDEX "UserOfficeAssignment_userId_idx" ON "UserOfficeAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserOfficeAssignment_officeId_idx" ON "UserOfficeAssignment"("officeId");

-- AddForeignKey
ALTER TABLE "UserOfficeAssignment" ADD CONSTRAINT "UserOfficeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfficeAssignment" ADD CONSTRAINT "UserOfficeAssignment_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;