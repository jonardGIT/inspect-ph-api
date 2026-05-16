import "../env.js";

import { prisma } from "../lib/prisma.js";

const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const MARKET_MODULE_ID = "6af2d08a-f615-4108-aa6f-32cd59f63708";
const MARKET_OFFICE_ID = "9076a792-ecb2-4241-949f-d0f6ac6774b6";
const MARKET_BUSINESS_ID = "924fe9a8-74cf-4408-8753-e67f6b32ebfe";
const MARKET_PERMIT_ID = "3a1ed5aa-1c66-4672-b0d1-d3f83bdf06e6";
const MARKET_INSPECTION_ID = "03b0cb57-ad4c-4814-a3bb-1942c8bc7f59";
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
    where: { id: MARKET_MODULE_ID },
    update: {
      code: "MARKET",
      description: "Public market inspection and stall compliance operations",
      isActive: true,
      name: "MarketGuard",
    },
    create: {
      id: MARKET_MODULE_ID,
      code: "MARKET",
      description: "Public market inspection and stall compliance operations",
      isActive: true,
      name: "MarketGuard",
    },
  });

  const office = await prisma.office.upsert({
    where: { id: MARKET_OFFICE_ID },
    update: {
      code: "MKT-HQ",
      description:
        "Public market sanitation and stall inspection operations center",
      lguId: lgu.id,
      name: "Market Operations Headquarters",
    },
    create: {
      id: MARKET_OFFICE_ID,
      code: "MKT-HQ",
      description:
        "Public market sanitation and stall inspection operations center",
      lguId: lgu.id,
      name: "Market Operations Headquarters",
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
    where: { id: MARKET_BUSINESS_ID },
    update: {
      addressLine: "Zone 3 Market Lane",
      barangay: "Centro 10",
      businessName: "Bagong Silang Public Market Stall 12",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0192",
      ownerName: "Liza Mendoza",
      province: "Cagayan",
      tradeName: "Bagong Silang Stall 12",
    },
    create: {
      id: MARKET_BUSINESS_ID,
      addressLine: "Zone 3 Market Lane",
      barangay: "Centro 10",
      businessName: "Bagong Silang Public Market Stall 12",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0192",
      ownerName: "Liza Mendoza",
      province: "Cagayan",
      tradeName: "Bagong Silang Stall 12",
    },
  });

  const permit = await prisma.permitRecord.upsert({
    where: { id: MARKET_PERMIT_ID },
    update: {
      applicationDate: new Date("2026-05-27T08:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-27T08:00:00.000Z"),
      lineOfBusiness: "Public market stall operations",
      permitNumber: "MARKET-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
    create: {
      id: MARKET_PERMIT_ID,
      applicationDate: new Date("2026-05-27T08:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-27T08:00:00.000Z"),
      lineOfBusiness: "Public market stall operations",
      permitNumber: "MARKET-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
  });

  const inspection = await prisma.inspection.upsert({
    where: { id: MARKET_INSPECTION_ID },
    update: {
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 6,
      locationLatitude: 17.6159,
      locationLongitude: 121.7264,
      notes:
        "Seeded MarketGuard inspection proving the shared inspection queue can be reused for public market operations.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-28T06:30:00.000Z"),
      status: "SCHEDULED",
    },
    create: {
      id: MARKET_INSPECTION_ID,
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 6,
      locationLatitude: 17.6159,
      locationLongitude: 121.7264,
      notes:
        "Seeded MarketGuard inspection proving the shared inspection queue can be reused for public market operations.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-28T06:30:00.000Z"),
      status: "SCHEDULED",
    },
  });

  const CHECKLIST_ITEMS = [
    {
      code: "MARKET-001",
      description:
        "Stall permit, business registration, and health permits for food handlers must be current and posted.",
      sortOrder: 1,
      title: "Stall permit and documentation compliance",
    },
    {
      code: "MARKET-002",
      description:
        "Food products must be stored at safe temperatures, protected from contamination, and properly labelled.",
      sortOrder: 2,
      title: "Food storage and handling safety",
    },
    {
      code: "MARKET-003",
      description:
        "Stall area, display surfaces, utensils, and food contact materials must be clean and free of pest evidence.",
      sortOrder: 3,
      title: "Stall sanitation and cleanliness",
    },
    {
      code: "MARKET-004",
      description:
        "Solid waste must be segregated and disposed of at the designated collection point; drainage must be clear.",
      sortOrder: 4,
      title: "Waste management and drainage",
    },
    {
      code: "MARKET-005",
      description:
        "No evidence of rodents, insects, or vectors; pest-control schedule and records must be available for inspection.",
      sortOrder: 5,
      title: "Pest control and public health measures",
    },
  ];

  for (const item of CHECKLIST_ITEMS) {
    await prisma.checklistTemplate.upsert({
      where: { code: item.code },
      update: {
        description: item.description,
        isActive: true,
        module: "MARKET",
        sortOrder: item.sortOrder,
        title: item.title,
      },
      create: {
        code: item.code,
        description: item.description,
        isActive: true,
        module: "MARKET",
        sortOrder: item.sortOrder,
        title: item.title,
      },
    });
  }

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
