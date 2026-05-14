import "../env.js";

import { prisma } from "../lib/prisma.js";

const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const BUILD_MODULE_ID = "844c75fe-c4b7-40ba-9031-68e92b07af6c";
const BUILD_OFFICE_ID = "3cb5bcae-91cc-43a0-86b1-d49cfc4bfe2a";
const BUILD_BUSINESS_ID = "457cf154-4812-4dda-bb28-f7b4837a7514";
const BUILD_PERMIT_ID = "7d49fa24-1fbe-4dc6-a344-7f7a459ec49b";
const BUILD_INSPECTION_ID = "4f137a3f-7658-428d-bdbf-5af7d7e0da52";
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
    where: { id: BUILD_MODULE_ID },
    update: {
      code: "BUILD",
      description: "Building permit and safety inspection operations",
      isActive: true,
      name: "BuildSure PH",
    },
    create: {
      id: BUILD_MODULE_ID,
      code: "BUILD",
      description: "Building permit and safety inspection operations",
      isActive: true,
      name: "BuildSure PH",
    },
  });

  const office = await prisma.office.upsert({
    where: { id: BUILD_OFFICE_ID },
    update: {
      code: "BLD-HQ",
      description: "Building safety and permit operations center",
      lguId: lgu.id,
      name: "Building Safety Headquarters",
    },
    create: {
      id: BUILD_OFFICE_ID,
      code: "BLD-HQ",
      description: "Building safety and permit operations center",
      lguId: lgu.id,
      name: "Building Safety Headquarters",
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
    where: { id: BUILD_BUSINESS_ID },
    update: {
      addressLine: "47 Mabini Street",
      barangay: "Centro 11",
      businessName: "North Ridge Hardware",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0166",
      ownerName: "Pedro Santos",
      province: "Cagayan",
      tradeName: "North Ridge",
    },
    create: {
      id: BUILD_BUSINESS_ID,
      addressLine: "47 Mabini Street",
      barangay: "Centro 11",
      businessName: "North Ridge Hardware",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0166",
      ownerName: "Pedro Santos",
      province: "Cagayan",
      tradeName: "North Ridge",
    },
  });

  const permit = await prisma.permitRecord.upsert({
    where: { id: BUILD_PERMIT_ID },
    update: {
      applicationDate: new Date("2026-05-24T09:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-24T09:00:00.000Z"),
      lineOfBusiness: "Building materials retail",
      permitNumber: "BUILD-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
    create: {
      id: BUILD_PERMIT_ID,
      applicationDate: new Date("2026-05-24T09:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-24T09:00:00.000Z"),
      lineOfBusiness: "Building materials retail",
      permitNumber: "BUILD-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
  });

  const inspection = await prisma.inspection.upsert({
    where: { id: BUILD_INSPECTION_ID },
    update: {
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 7,
      locationLatitude: 17.6182,
      locationLongitude: 121.7301,
      notes:
        "Seeded BuildSure inspection proving the generic module assignment path scales to another office.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-26T14:00:00.000Z"),
      status: "SCHEDULED",
    },
    create: {
      id: BUILD_INSPECTION_ID,
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 7,
      locationLatitude: 17.6182,
      locationLongitude: 121.7301,
      notes:
        "Seeded BuildSure inspection proving the generic module assignment path scales to another office.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-26T14:00:00.000Z"),
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
