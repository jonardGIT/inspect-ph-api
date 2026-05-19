/**
 * seed-dev-field-data.ts
 *
 * Adds the rich dataset the mobile app needs to feel real:
 *   • 4 more businesses across Tuguegarao barangays
 *   • 4 more permits in varied statuses
 *   • 8 more inspections spanning past/today/future with GPS coordinates
 *   • 1 completed inspection with FireSafetyCertificate, InspectionChecklistResults,
 *     Findings linked to checklist items, and Attachment metadata
 *
 * Dependencies (must run first):
 *   npm run seed:dev-inspector          → inspector user, LGU, office
 *   npm run seed:dev-inspections        → inspector assignment confirmed
 *   npm run seed:dev-checklist-templates → template IDs
 */
import "../env.js";

import { prisma } from "../lib/prisma.js";

// ── From seed-dev-inspector ────────────────────────────────────────────────
const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const DEV_OFFICE_ID = "de4fc261-5b19-46bc-b0ec-702fa58e23bf";
const DEV_INSPECTOR_EMAIL = "inspector@example.com";

// ── From seed-dev-checklist-templates ─────────────────────────────────────
const TMPL_BPLO_GENERAL_ID = "c1d2e3f4-0001-4000-8000-000000000001";
const TMPL_FIRE_SAFETY_ID = "c1d2e3f4-0002-4000-8000-000000000002";
const TMPL_SANITATION_ID = "c1d2e3f4-0003-4000-8000-000000000003";

// ── New businesses ─────────────────────────────────────────────────────────
const BIZ_SUNRISE_ID = "f2a3b4c5-0001-4000-8000-000000000001";
const BIZ_CAGAYANTECH_ID = "f2a3b4c5-0002-4000-8000-000000000002";
const BIZ_GREEN_MART_ID = "f2a3b4c5-0003-4000-8000-000000000003";
const BIZ_VALLEY_HOTEL_ID = "f2a3b4c5-0004-4000-8000-000000000004";

// ── New permits ────────────────────────────────────────────────────────────
const PERMIT_SUNRISE_ID = "f3a4b5c6-0001-4000-8000-000000000001";
const PERMIT_CAGAYANTECH_ID = "f3a4b5c6-0002-4000-8000-000000000002";
const PERMIT_GREEN_MART_ID = "f3a4b5c6-0003-4000-8000-000000000003";
const PERMIT_VALLEY_HOTEL_ID = "f3a4b5c6-0004-4000-8000-000000000004";

// ── New inspections ────────────────────────────────────────────────────────
// Spread across 3 weeks so the schedule view is interesting
const INSP_01_ID = "f4a5b6c7-0001-4000-8000-000000000001"; // COMPLETED  May 8
const INSP_02_ID = "f4a5b6c7-0002-4000-8000-000000000002"; // COMPLETED  May 12
const INSP_03_ID = "f4a5b6c7-0003-4000-8000-000000000003"; // OVERDUE    May 13
const INSP_04_ID = "f4a5b6c7-0004-4000-8000-000000000004"; // SCHEDULED  May 19
const INSP_05_ID = "f4a5b6c7-0005-4000-8000-000000000005"; // SCHEDULED  May 20
const INSP_06_ID = "f4a5b6c7-0006-4000-8000-000000000006"; // SCHEDULED  May 21
const INSP_07_ID = "f4a5b6c7-0007-4000-8000-000000000007"; // SCHEDULED  May 17 (today)
const INSP_08_ID = "f4a5b6c7-0008-4000-8000-000000000008"; // IN_PROGRESS May 17 (today)

// ── Detail-screen data for INSP_01 (Sunrise Bakery, completed) ─────────────
const FSC_ID = "f5a6b7c8-0001-4000-8000-000000000001";
const CKLST_RESULT_01_ID = "f6a7b8c9-0001-4000-8000-000000000001";
const CKLST_RESULT_02_ID = "f6a7b8c9-0002-4000-8000-000000000002";
const CKLST_RESULT_03_ID = "f6a7b8c9-0003-4000-8000-000000000003";
const FINDING_01_ID = "f8a9b0c1-0001-4000-8000-000000000001";
const ATT_01_ID = "f7a8b9c0-0001-4000-8000-000000000001";
const ATT_02_ID = "f7a8b9c0-0002-4000-8000-000000000002";

async function main() {
  // ── Guards ───────────────────────────────────────────────────────────────
  const inspector = await prisma.user.findUnique({
    where: { email: DEV_INSPECTOR_EMAIL },
  });
  if (!inspector) {
    throw new Error(
      "Inspector user not found. Run npm run seed:dev-inspector first.",
    );
  }

  const lgu = await prisma.lgu.findUnique({ where: { id: DEV_LGU_ID } });
  if (!lgu) {
    throw new Error("Dev LGU not found. Run npm run seed:dev-inspector first.");
  }

  const tmplBplo = await prisma.checklistTemplate.findUnique({
    where: { id: TMPL_BPLO_GENERAL_ID },
  });
  if (!tmplBplo) {
    throw new Error(
      "Checklist templates not found. Run npm run seed:dev-checklist-templates first.",
    );
  }

  // ── Businesses ───────────────────────────────────────────────────────────
  const sunrise = await prisma.businessEstablishment.upsert({
    where: { id: BIZ_SUNRISE_ID },
    update: {},
    create: {
      id: BIZ_SUNRISE_ID,
      addressLine: "45 Mabini Street",
      barangay: "Annafunan East",
      businessName: "Sunrise Bakery",
      city: "Tuguegarao City",
      contactNumber: "+63 917 555 0201",
      ownerName: "Juan dela Cruz",
      province: "Cagayan",
      tradeName: "Sunrise",
    },
  });

  const cagayantech = await prisma.businessEstablishment.upsert({
    where: { id: BIZ_CAGAYANTECH_ID },
    update: {},
    create: {
      id: BIZ_CAGAYANTECH_ID,
      addressLine: "88 Burgos Avenue",
      barangay: "Capatan",
      businessName: "CagayenTech Supplies",
      city: "Tuguegarao City",
      contactNumber: "+63 918 555 0302",
      ownerName: "Roberto Lim",
      province: "Cagayan",
      taxIdentificationNumber: "123-456-789-000",
    },
  });

  const greenMart = await prisma.businessEstablishment.upsert({
    where: { id: BIZ_GREEN_MART_ID },
    update: {},
    create: {
      id: BIZ_GREEN_MART_ID,
      addressLine: "12 Luna Road",
      barangay: "Carig Sur",
      businessName: "Green Mart Grocery",
      city: "Tuguegarao City",
      contactNumber: "+63 919 555 0403",
      ownerName: "Elena Bautista",
      province: "Cagayan",
    },
  });

  const valleyHotel = await prisma.businessEstablishment.upsert({
    where: { id: BIZ_VALLEY_HOTEL_ID },
    update: {},
    create: {
      id: BIZ_VALLEY_HOTEL_ID,
      addressLine: "3 Maharlika Highway",
      barangay: "Ugac Norte",
      businessName: "Valley Heights Hotel",
      city: "Tuguegarao City",
      contactNumber: "+63 920 555 0504",
      ownerName: "Patricio Reyes",
      province: "Cagayan",
      tradeName: "Valley Heights",
    },
  });

  // ── Permits ──────────────────────────────────────────────────────────────
  const permitSunrise = await prisma.permitRecord.upsert({
    where: { id: PERMIT_SUNRISE_ID },
    update: {},
    create: {
      id: PERMIT_SUNRISE_ID,
      applicationDate: new Date("2026-04-01T08:00:00.000Z"),
      businessId: sunrise.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-04-01T08:00:00.000Z"),
      lineOfBusiness: "Food and Beverage",
      permitNumber: "BPLO-DEV-2026-0002",
      status: "APPROVED",
    },
  });

  const permitCagayantech = await prisma.permitRecord.upsert({
    where: { id: PERMIT_CAGAYANTECH_ID },
    update: {},
    create: {
      id: PERMIT_CAGAYANTECH_ID,
      applicationDate: new Date("2026-05-02T08:00:00.000Z"),
      businessId: cagayantech.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-02T08:00:00.000Z"),
      lineOfBusiness: "Hardware and Industrial Supply",
      permitNumber: "BPLO-DEV-2026-0003",
      status: "PENDING_INSPECTION",
    },
  });

  const permitGreenMart = await prisma.permitRecord.upsert({
    where: { id: PERMIT_GREEN_MART_ID },
    update: {},
    create: {
      id: PERMIT_GREEN_MART_ID,
      applicationDate: new Date("2026-03-15T08:00:00.000Z"),
      businessId: greenMart.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-03-15T08:00:00.000Z"),
      lineOfBusiness: "Grocery and General Merchandise",
      permitNumber: "BPLO-DEV-2026-0004",
      status: "APPROVED",
    },
  });

  const permitValleyHotel = await prisma.permitRecord.upsert({
    where: { id: PERMIT_VALLEY_HOTEL_ID },
    update: {},
    create: {
      id: PERMIT_VALLEY_HOTEL_ID,
      applicationDate: new Date("2026-05-05T08:00:00.000Z"),
      businessId: valleyHotel.id,
      createdById: inspector.id,
      expirationDate: new Date("2027-05-05T08:00:00.000Z"),
      lineOfBusiness: "Accommodation and Lodging",
      permitNumber: "BPLO-DEV-2026-0005",
      status: "PENDING_INSPECTION",
    },
  });

  // ── Inspections ──────────────────────────────────────────────────────────
  // INSP_01 — COMPLETED May 8, Sunrise Bakery (Annafunan East)
  const insp01 = await prisma.inspection.upsert({
    where: { id: INSP_01_ID },
    update: {},
    create: {
      id: INSP_01_ID,
      businessId: sunrise.id,
      completedAt: new Date("2026-05-08T11:30:00.000Z"),
      inspectorId: inspector.id,
      locationAccuracyMeters: 5,
      locationLatitude: 17.6271,
      locationLongitude: 121.7182,
      notes: "Annual fire safety and sanitation inspection.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitSunrise.id,
      scheduledAt: new Date("2026-05-08T09:00:00.000Z"),
      startedAt: new Date("2026-05-08T09:10:00.000Z"),
      status: "COMPLETED",
    },
  });

  // INSP_02 — COMPLETED May 12, Green Mart (Carig Sur)
  const insp02 = await prisma.inspection.upsert({
    where: { id: INSP_02_ID },
    update: {},
    create: {
      id: INSP_02_ID,
      businessId: greenMart.id,
      completedAt: new Date("2026-05-12T16:00:00.000Z"),
      inspectorId: inspector.id,
      locationAccuracyMeters: 6,
      locationLatitude: 17.6053,
      locationLongitude: 121.7391,
      notes: "BPLO general permit inspection.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitGreenMart.id,
      scheduledAt: new Date("2026-05-12T14:00:00.000Z"),
      startedAt: new Date("2026-05-12T14:05:00.000Z"),
      status: "COMPLETED",
    },
  });

  // INSP_03 — OVERDUE May 13, CagayenTech (Capatan)
  const insp03 = await prisma.inspection.upsert({
    where: { id: INSP_03_ID },
    update: {},
    create: {
      id: INSP_03_ID,
      businessId: cagayantech.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 8,
      locationLatitude: 17.5972,
      locationLongitude: 121.7144,
      notes: "Initial permit inspection — missed scheduled date.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitCagayantech.id,
      scheduledAt: new Date("2026-05-13T10:00:00.000Z"),
      status: "OVERDUE",
    },
  });

  // INSP_04 — SCHEDULED May 19, Valley Heights Hotel (Ugac Norte)
  const insp04 = await prisma.inspection.upsert({
    where: { id: INSP_04_ID },
    update: {},
    create: {
      id: INSP_04_ID,
      businessId: valleyHotel.id,
      inspectorId: inspector.id,
      locationLatitude: 17.6153,
      locationLongitude: 121.7324,
      notes: "Full hotel safety and sanitation inspection.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitValleyHotel.id,
      scheduledAt: new Date("2026-05-19T09:00:00.000Z"),
      status: "SCHEDULED",
    },
  });

  // INSP_05 — SCHEDULED May 20, Sunrise Bakery (Annafunan East)
  const insp05 = await prisma.inspection.upsert({
    where: { id: INSP_05_ID },
    update: {},
    create: {
      id: INSP_05_ID,
      businessId: sunrise.id,
      inspectorId: inspector.id,
      locationLatitude: 17.6271,
      locationLongitude: 121.7182,
      notes: "Follow-up fire safety inspection.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitSunrise.id,
      scheduledAt: new Date("2026-05-20T10:00:00.000Z"),
      status: "SCHEDULED",
    },
  });

  // INSP_06 — SCHEDULED May 21, CagayenTech (Capatan)
  const insp06 = await prisma.inspection.upsert({
    where: { id: INSP_06_ID },
    update: {},
    create: {
      id: INSP_06_ID,
      businessId: cagayantech.id,
      inspectorId: inspector.id,
      locationLatitude: 17.5972,
      locationLongitude: 121.7144,
      notes: "Rescheduled from overdue May 13 slot.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitCagayantech.id,
      scheduledAt: new Date("2026-05-21T14:00:00.000Z"),
      status: "SCHEDULED",
    },
  });

  // INSP_07 — SCHEDULED today May 17, Green Mart (Centro 3)
  const insp07 = await prisma.inspection.upsert({
    where: { id: INSP_07_ID },
    update: {},
    create: {
      id: INSP_07_ID,
      businessId: greenMart.id,
      inspectorId: inspector.id,
      locationLatitude: 17.6213,
      locationLongitude: 121.7247,
      notes: "Spot check — sanitation follow-up.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitGreenMart.id,
      scheduledAt: new Date("2026-05-17T08:30:00.000Z"),
      status: "SCHEDULED",
    },
  });

  // INSP_08 — IN_PROGRESS today May 17, Valley Heights Hotel (Leonarda)
  const insp08 = await prisma.inspection.upsert({
    where: { id: INSP_08_ID },
    update: {},
    create: {
      id: INSP_08_ID,
      businessId: valleyHotel.id,
      inspectorId: inspector.id,
      locationAccuracyMeters: 4,
      locationLatitude: 17.6301,
      locationLongitude: 121.7163,
      notes: "Ongoing — inspector on-site.",
      officeId: DEV_OFFICE_ID,
      permitRecordId: permitValleyHotel.id,
      scheduledAt: new Date("2026-05-17T09:30:00.000Z"),
      startedAt: new Date("2026-05-17T09:35:00.000Z"),
      status: "IN_PROGRESS",
    },
  });

  // ── Fire Safety Certificate for INSP_01 ──────────────────────────────────
  await prisma.fireSafetyCertificate.upsert({
    where: { id: FSC_ID },
    update: {},
    create: {
      id: FSC_ID,
      certificateNumber: "FSC-DEV-2026-0001",
      expiresAt: new Date("2027-05-08T00:00:00.000Z"),
      inspectionId: insp01.id,
      issuedAt: new Date("2026-05-08T12:00:00.000Z"),
      remarks:
        "All fire safety requirements met. Certificate valid for 1 year.",
      status: "ISSUED",
      verificationUrl: "https://inspect.ph/verify/FSC-DEV-2026-0001",
    },
  });

  // ── Checklist results for INSP_01 ────────────────────────────────────────
  const cklst01 = await prisma.inspectionChecklistResult.upsert({
    where: { id: CKLST_RESULT_01_ID },
    update: {},
    create: {
      id: CKLST_RESULT_01_ID,
      inspectionId: insp01.id,
      remarks: "All business registration documents present and valid.",
      status: "PASS",
      templateId: TMPL_BPLO_GENERAL_ID,
      templateVersion: 1,
    },
  });

  const cklst02 = await prisma.inspectionChecklistResult.upsert({
    where: { id: CKLST_RESULT_02_ID },
    update: {},
    create: {
      id: CKLST_RESULT_02_ID,
      inspectionId: insp01.id,
      remarks:
        "Fire extinguisher near rear exit is past its service date. Exit signage dim.",
      status: "FAIL",
      templateId: TMPL_FIRE_SAFETY_ID,
      templateVersion: 2,
    },
  });

  await prisma.inspectionChecklistResult.upsert({
    where: { id: CKLST_RESULT_03_ID },
    update: {},
    create: {
      id: CKLST_RESULT_03_ID,
      inspectionId: insp01.id,
      remarks:
        "Kitchen and display area clean. Pest control records up to date.",
      status: "PASS",
      templateId: TMPL_SANITATION_ID,
      templateVersion: 1,
    },
  });

  // ── Finding linked to the FAIL checklist result ──────────────────────────
  await prisma.finding.upsert({
    where: { id: FINDING_01_ID },
    update: {},
    create: {
      id: FINDING_01_ID,
      checklistResultId: cklst02.id,
      correctiveAction:
        "Replace fire extinguisher at rear exit with a currently serviced unit. Replace dim exit sign bulb.",
      description:
        "Rear-exit fire extinguisher tag shows last service date of March 2024. Exit sign illumination is below required lux level.",
      dueDate: new Date("2026-06-08T00:00:00.000Z"),
      inspectionId: insp01.id,
      locationLatitude: 17.6271,
      locationLongitude: 121.7182,
      severity: "HIGH",
      title: "Fire extinguisher overdue for service + dim exit sign",
    },
  });

  // ── Attachments for INSP_01 ──────────────────────────────────────────────
  await prisma.attachment.upsert({
    where: { id: ATT_01_ID },
    update: {},
    create: {
      id: ATT_01_ID,
      capturedAt: new Date("2026-05-08T09:15:00.000Z"),
      fileName: "entrance-photo.jpg",
      fileSizeBytes: 1_482_240,
      inspectionId: insp01.id,
      locationAccuracyMeters: 5,
      locationLatitude: 17.6271,
      locationLongitude: 121.7182,
      mimeType: "image/jpeg",
      storageKey:
        "dev/inspections/f4a5b6c7-0001-4000-8000-000000000001/entrance-photo.jpg",
    },
  });

  await prisma.attachment.upsert({
    where: { id: ATT_02_ID },
    update: {},
    create: {
      id: ATT_02_ID,
      capturedAt: new Date("2026-05-08T09:40:00.000Z"),
      fileName: "fire-extinguisher-rear.jpg",
      fileSizeBytes: 1_044_480,
      findingId: FINDING_01_ID,
      inspectionId: insp01.id,
      locationLatitude: 17.6271,
      locationLongitude: 121.7182,
      mimeType: "image/jpeg",
      storageKey:
        "dev/inspections/f4a5b6c7-0001-4000-8000-000000000001/fire-extinguisher-rear.jpg",
    },
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(
    JSON.stringify(
      {
        businesses: [sunrise, cagayantech, greenMart, valleyHotel].map((b) => ({
          id: b.id,
          name: b.businessName,
        })),
        inspections: {
          [insp01.id]: { date: "2026-05-08", status: insp01.status },
          [insp02.id]: { date: "2026-05-12", status: insp02.status },
          [insp03.id]: { date: "2026-05-13", status: insp03.status },
          [insp04.id]: { date: "2026-05-19", status: insp04.status },
          [insp05.id]: { date: "2026-05-20", status: insp05.status },
          [insp06.id]: { date: "2026-05-21", status: insp06.status },
          [insp07.id]: { date: "2026-05-17", status: insp07.status },
          [insp08.id]: { date: "2026-05-17", status: insp08.status },
        },
        permits: [
          permitSunrise,
          permitCagayantech,
          permitGreenMart,
          permitValleyHotel,
        ].map((p) => ({ id: p.id, number: p.permitNumber, status: p.status })),
        richInspection: {
          id: insp01.id,
          attachments: 2,
          checklistResults: 3,
          findings: 1,
          fireSafetyCertificate: "FSC-DEV-2026-0001",
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
