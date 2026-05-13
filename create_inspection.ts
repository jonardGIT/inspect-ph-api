import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'inspector@example.com';
  const inspector = await prisma.user.findFirst({
    where: { email: email, role: 'INSPECTOR' },
  });

  if (!inspector) {
    console.error('User with email ' + email + ' and role INSPECTOR not found.');
    process.exit(1);
  }

  const timestamp = Date.now();
  const businessName = 'Business-' + timestamp;
  const permitNumber = 'BP-' + timestamp;

  const business = await prisma.businessEstablishment.create({
    data: {
      businessName: businessName,
      ownerName: 'Seed Owner',
      addressLine: '123 Seed Street',
      barangay: 'Seed Barangay',
      city: 'Seed City',
      province: 'Seed Province',
    },
  });

  const permit = await prisma.permitRecord.create({
    data: {
      businessId: business.id,
      permitNumber: permitNumber,
      applicationDate: new Date(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lineOfBusiness: 'Retail',
      status: 'PENDING_INSPECTION',
    },
  });

  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); 
  const inspection = await prisma.inspection.create({
    data: {
      businessId: business.id,
      permitRecordId: permit.id,
      inspectorId: inspector.id,
      scheduledAt: scheduledAt,
      status: 'SCHEDULED',
      notes: 'Mobile seeded assignment',
    },
  });

  console.log(JSON.stringify({
    businessId: business.id,
    permitId: permit.id,
    inspectionId: inspection.id,
    inspectorId: inspector.id,
    businessName: business.businessName,
    permitNumber: permit.permitNumber,
    scheduledAt: inspection.scheduledAt.toISOString(),
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
