import "../env.js";

import { prisma } from "../lib/prisma.js";

const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const SANITA_MODULE_ID = "b1918a8b-f18c-49b3-beb8-bf9cad5cb8d8";
const SANITA_OFFICE_ID = "7751e691-7b08-40eb-8bbc-0c2382b90ec7";
const SANITA_BUSINESS_ID = "4abec031-dbbb-4f68-b657-ee683fda6158";
const SANITA_PERMIT_ID = "4adbf397-8639-4738-8ac1-b450ff20b6af";
const SANITA_INSPECTION_ID = "dc52b976-9d52-4cee-af42-a4b5594ff681";
const INSPECTOR_EMAIL = "inspector@example.com";

async function main() {
  const inspector = await prisma.user.findUnique({
    where: { email: INSPECTOR_EMAIL },
  });

  if (!inspector) {
    throw new Error(
      "Inspector user was not found. Run npm run seed:dev-inspector first.",
    );
  }

  const lgu = await prisma.lgu.findUnique({ where: { id: DEV_LGU_ID } });

  if (!lgu) {
    throw new Error(
      "Dev LGU was not found. Run npm run seed:dev-inspector first.",
    );
  }

  const module = await prisma.module.upsert({
    where: { id: SANITA_MODULE_ID },
    update: {
      code: "SANITA",
      description: "Sanitation inspection operations",
      isActive: true,
      name: "SanitaCheck",
    },
    create: {
      id: SANITA_MODULE_ID,
      code: "SANITA",
      description: "Sanitation inspection operations",
      isActive: true,
      name: "SanitaCheck",
    },
  });

  const office = await prisma.office.upsert({
    where: { id: SANITA_OFFICE_ID },
    update: {
      code: "SAN-HQ",
      description: "Sanitation inspection operations center",
      lguId: lgu.id,
      name: "Sanitation Services Headquarters",
    },
    create: {
      id: SANITA_OFFICE_ID,
      code: "SAN-HQ",
      description: "Sanitation inspection operations center",
      lguId: lgu.id,
      name: "Sanitation Services Headquarters",
    },
  });

  await prisma.officeModule.upsert({
    where: {
      officeId_moduleId: {
        moduleId: module.id,
        officeId: office.id,
      },
    },
    update: {},
    create: {
      moduleId: module.id,
      officeId: office.id,
    },
  });

  await prisma.userOfficeAssignment.upsert({
    where: {
      userId_officeId: {
        officeId: office.id,
        userId: inspector.id,
      },
    },
    update: {},
    create: {
      officeId: office.id,
      userId: inspector.id,
    },
  });

  const business = await prisma.businessEstablishment.upsert({
    where: { id: SANITA_BUSINESS_ID },
    update: {
      addressLine: "18 Bonifacio Street",
      barangay: "Centro 10",
      businessName: "Golden Spoon Eatery",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0144",
      ownerName: "Maria Dela Cruz",
      province: "Cagayan",
      tradeName: "Golden Spoon",
    },
    create: {
      id: SANITA_BUSINESS_ID,
      addressLine: "18 Bonifacio Street",
      barangay: "Centro 10",
      businessName: "Golden Spoon Eatery",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0144",
      ownerName: "Maria Dela Cruz",
      province: "Cagayan",
      tradeName: "Golden Spoon",
    },
  });

  const permit = await prisma.permitRecord.upsert({
    where: { id: SANITA_PERMIT_ID },
    update: {
      applicationDate: new Date("2026-05-20T08:30:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-20T08:30:00.000Z"),
      lineOfBusiness: "Restaurant operations",
      permitNumber: "SAN-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
    create: {
      id: SANITA_PERMIT_ID,
      applicationDate: new Date("2026-05-20T08:30:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-20T08:30:00.000Z"),
      lineOfBusiness: "Restaurant operations",
      permitNumber: "SAN-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
  });

  const inspection = await prisma.inspection.upsert({
    where: { id: SANITA_INSPECTION_ID },
    update: {
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 6,
      locationLatitude: 17.6138,
      locationLongitude: 121.7244,
      notes:
        "Seeded SanitaCheck inspection proving another module can reuse the core queue.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-22T10:00:00.000Z"),
      status: "SCHEDULED",
    },
    create: {
      id: SANITA_INSPECTION_ID,
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 6,
      locationLatitude: 17.6138,
      locationLongitude: 121.7244,
      notes:
        "Seeded SanitaCheck inspection proving another module can reuse the core queue.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-22T10:00:00.000Z"),
      status: "SCHEDULED",
    },
  });

  console.log(
    JSON.stringify(
      {
        business: {
          id: business.id,
          name: business.businessName,
        },
        inspection: {
          id: inspection.id,
          officeId: office.id,
          scheduledAt: inspection.scheduledAt.toISOString(),
          status: inspection.status,
        },
        inspector: {
          email: INSPECTOR_EMAIL,
          id: inspector.id,
          officeId: office.id,
        },
        module: {
          code: module.code,
          id: module.id,
          name: module.name,
        },
        office: {
          code: office.code,
          id: office.id,
          name: office.name,
        },
        permit: {
          id: permit.id,
          permitNumber: permit.permitNumber,
          status: permit.status,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
