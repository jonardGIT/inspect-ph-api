import "../env.js";

import { prisma } from "../lib/prisma.js";

const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const DEV_OFFICE_ID = "de4fc261-5b19-46bc-b0ec-702fa58e23bf";
const DEV_BUSINESS_ID = "f15de43c-d0df-4324-a069-cfa5145a7a6a";
const DEV_PERMIT_ID = "dc206a56-2ec0-48d0-9d33-e51a1e308cf9";
const DEV_SCHEDULED_INSPECTION_ID = "251d8bd9-ffde-4d95-889f-fffdf2ce1085";
const DEV_MAP_INSPECTION_ID = "7d6e77dd-a2e2-4fdb-bb6f-90d8687cc8d1";
const DEV_INSPECTOR_EMAIL = "inspector@example.com";

async function main() {
  const inspector = await prisma.user.findUnique({
    where: { email: DEV_INSPECTOR_EMAIL },
  });

  if (!inspector) {
    throw new Error(
      "Inspector user was not found. Run npm run seed:dev-inspector first.",
    );
  }

  const lgu = await prisma.lgu.upsert({
    where: { id: DEV_LGU_ID },
    update: {
      code: "TUG-DEV",
      name: "Tuguegarao Dev LGU",
    },
    create: {
      id: DEV_LGU_ID,
      code: "TUG-DEV",
      name: "Tuguegarao Dev LGU",
    },
  });

  const office = await prisma.office.upsert({
    where: { id: DEV_OFFICE_ID },
    update: {
      code: "BPLO-HQ",
      lguId: lgu.id,
      name: "BPLO Headquarters",
    },
    create: {
      id: DEV_OFFICE_ID,
      code: "BPLO-HQ",
      lguId: lgu.id,
      name: "BPLO Headquarters",
    },
  });

  await prisma.user.update({
    where: { id: inspector.id },
    data: {
      lguId: lgu.id,
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
    where: { id: DEV_BUSINESS_ID },
    update: {
      addressLine: "12 Rizal Street",
      barangay: "Centro 10",
      businessName: "North Star Trading",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0101",
      ownerName: "Maria Santos",
      province: "Cagayan",
      tradeName: "North Star",
    },
    create: {
      id: DEV_BUSINESS_ID,
      addressLine: "12 Rizal Street",
      barangay: "Centro 10",
      businessName: "North Star Trading",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0101",
      ownerName: "Maria Santos",
      province: "Cagayan",
      tradeName: "North Star",
    },
  });

  const permit = await prisma.permitRecord.upsert({
    where: { id: DEV_PERMIT_ID },
    update: {
      applicationDate: new Date("2026-05-01T08:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-01T08:00:00.000Z"),
      lineOfBusiness: "Retail",
      permitNumber: "BPLO-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
    create: {
      id: DEV_PERMIT_ID,
      applicationDate: new Date("2026-05-01T08:00:00.000Z"),
      businessId: business.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-01T08:00:00.000Z"),
      lineOfBusiness: "Retail",
      permitNumber: "BPLO-DEV-2026-0001",
      status: "PENDING_INSPECTION",
    },
  });

  const scheduledInspection = await prisma.inspection.upsert({
    where: { id: DEV_SCHEDULED_INSPECTION_ID },
    update: {
      businessId: business.id,
      inspectorId: inspector.id,
      notes: "Scheduled BPLO field visit for permit renewal.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-16T09:00:00.000Z"),
      status: "SCHEDULED",
    },
    create: {
      id: DEV_SCHEDULED_INSPECTION_ID,
      businessId: business.id,
      inspectorId: inspector.id,
      notes: "Scheduled BPLO field visit for permit renewal.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-16T09:00:00.000Z"),
      status: "SCHEDULED",
    },
  });

  const mappedInspection = await prisma.inspection.upsert({
    where: { id: DEV_MAP_INSPECTION_ID },
    update: {
      businessId: business.id,
      completedAt: null,
      inspectorId: inspector.id,
      locationAccuracyMeters: 4,
      locationLatitude: 17.6132,
      locationLongitude: 121.727,
      notes: "Use this seeded record for the mobile map view.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-15T10:30:00.000Z"),
      startedAt: new Date("2026-05-15T10:45:00.000Z"),
      status: "IN_PROGRESS",
    },
    create: {
      id: DEV_MAP_INSPECTION_ID,
      businessId: business.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 4,
      locationLatitude: 17.6132,
      locationLongitude: 121.727,
      notes: "Use this seeded record for the mobile map view.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-15T10:30:00.000Z"),
      startedAt: new Date("2026-05-15T10:45:00.000Z"),
      status: "IN_PROGRESS",
    },
  });

  console.log(
    JSON.stringify(
      {
        business: {
          id: business.id,
          name: business.businessName,
        },
        inspector: {
          email: DEV_INSPECTOR_EMAIL,
          id: inspector.id,
          officeId: office.id,
        },
        inspections: [
          {
            id: scheduledInspection.id,
            scheduledAt: scheduledInspection.scheduledAt.toISOString(),
            status: scheduledInspection.status,
            type: "schedule",
          },
          {
            id: mappedInspection.id,
            latitude: mappedInspection.locationLatitude,
            longitude: mappedInspection.locationLongitude,
            scheduledAt: mappedInspection.scheduledAt.toISOString(),
            status: mappedInspection.status,
            type: "map",
          },
        ],
        office: {
          code: office.code,
          id: office.id,
          name: office.name,
        },
        permit: {
          id: permit.id,
          permitNumber: permit.permitNumber,
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
