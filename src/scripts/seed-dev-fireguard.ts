import "../env.js";

import { prisma } from "../lib/prisma.js";

const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const FIRE_MODULE_ID = "6bf58096-8d64-410e-a788-26baaeb3434b";
const FIRE_OFFICE_ID = "c31cb14f-4b7c-4291-aea4-44ad4b0d89a6";
const FIRE_BUSINESS_ID = "c7423e4c-3a47-4603-b514-558c0676c5ad";
const FIRE_PERMIT_ID = "27ab16e1-3ea7-4332-9d43-ac79f32bc58d";
const FIRE_INSPECTION_ID = "62364cb8-8d0c-4185-b648-ee8d4f114594";
const FIRE_CERTIFICATE_ID = "6ad6d306-452c-4a55-8417-d503bfe0ef6f";
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
    where: { id: FIRE_MODULE_ID },
    update: {
      code: "FIRE",
      description: "Fire safety inspection operations",
      isActive: true,
      name: "FireGuard Inspect",
    },
    create: {
      id: FIRE_MODULE_ID,
      code: "FIRE",
      description: "Fire safety inspection operations",
      isActive: true,
      name: "FireGuard Inspect",
    },
  });

  const office = await prisma.office.upsert({
    where: { id: FIRE_OFFICE_ID },
    update: {
      code: "FIRE-HQ",
      description: "Fire safety inspection command center",
      lguId: lgu.id,
      name: "Fire Safety Headquarters",
    },
    create: {
      id: FIRE_OFFICE_ID,
      code: "FIRE-HQ",
      description: "Fire safety inspection command center",
      lguId: lgu.id,
      name: "Fire Safety Headquarters",
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
    where: { id: FIRE_BUSINESS_ID },
    update: {
      addressLine: "21 Bonifacio Street",
      barangay: "Centro 8",
      businessName: "Apex Cold Storage",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0121",
      ownerName: "Roberto Cruz",
      province: "Cagayan",
      tradeName: "Apex Cold",
    },
    create: {
      id: FIRE_BUSINESS_ID,
      addressLine: "21 Bonifacio Street",
      barangay: "Centro 8",
      businessName: "Apex Cold Storage",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0121",
      ownerName: "Roberto Cruz",
      province: "Cagayan",
      tradeName: "Apex Cold",
    },
  });

  const permit = await prisma.permitRecord.upsert({
    where: { id: FIRE_PERMIT_ID },
    update: {
      applicationDate: new Date("2026-05-05T09:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-05T09:00:00.000Z"),
      lineOfBusiness: "Cold storage",
      permitNumber: "FIRE-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
    create: {
      id: FIRE_PERMIT_ID,
      applicationDate: new Date("2026-05-05T09:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-05T09:00:00.000Z"),
      lineOfBusiness: "Cold storage",
      permitNumber: "FIRE-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
  });

  const inspection = await prisma.inspection.upsert({
    where: { id: FIRE_INSPECTION_ID },
    update: {
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 5,
      locationLatitude: 17.6208,
      locationLongitude: 121.7312,
      notes:
        "Seeded FireGuard inspection proving second-module reuse of the core queue.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-17T13:30:00.000Z"),
      status: "SCHEDULED",
    },
    create: {
      id: FIRE_INSPECTION_ID,
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 5,
      locationLatitude: 17.6208,
      locationLongitude: 121.7312,
      notes:
        "Seeded FireGuard inspection proving second-module reuse of the core queue.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-17T13:30:00.000Z"),
      status: "SCHEDULED",
    },
  });

  const certificate = await prisma.fireSafetyCertificate.upsert({
    where: { inspectionId: inspection.id },
    update: {
      certificateNumber: "FSIC-DEV-2026-0001",
      expiresAt: new Date("2027-05-17T13:30:00.000Z"),
      issuedAt: new Date("2026-05-17T13:30:00.000Z"),
      remarks:
        "Seeded FireGuard certificate proving module-specific certificate support.",
      status: "ISSUED",
    },
    create: {
      id: FIRE_CERTIFICATE_ID,
      certificateNumber: "FSIC-DEV-2026-0001",
      expiresAt: new Date("2027-05-17T13:30:00.000Z"),
      inspectionId: inspection.id,
      issuedAt: new Date("2026-05-17T13:30:00.000Z"),
      remarks:
        "Seeded FireGuard certificate proving module-specific certificate support.",
      status: "ISSUED",
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
        certificate: {
          certificateNumber: certificate.certificateNumber,
          id: certificate.id,
          status: certificate.status,
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
