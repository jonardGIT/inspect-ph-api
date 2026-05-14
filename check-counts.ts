import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lguCount = await prisma.lgu.count();
  const officeCount = await prisma.office.count();
  const inspectionCount = await prisma.inspection.count();
  
  console.log({
    lguCount,
    officeCount,
    inspectionCount,
    inspectionOfficeIdNullCount: 0,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
