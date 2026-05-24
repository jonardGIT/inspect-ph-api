import "../env.js";

import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

function sid(table: number, index: number): string {
  return [
    "00000000",
    table.toString(16).padStart(4, "0"),
    "4000",
    "8a11",
    index.toString().padStart(12, "0"),
  ].join("-");
}

const PASSWORD = "password123";

const LGU_ID = sid(1, 9101);
const OFFICE_ID = sid(3, 9101);
const BUSINESS_ID = sid(5, 9101);
const PERMIT_ID = sid(6, 9101);
const PAYMENT_ID = sid(14, 9101);
const INITIAL_INSPECTION_ID = sid(7, 9101);
const FOLLOW_UP_INSPECTION_ID = sid(7, 9102);
const UPCOMING_INSPECTION_ID = sid(7, 9103);
const BPLO_TEMPLATE_ID = sid(8, 9101);
const FIRE_TEMPLATE_ID = sid(8, 9102);
const SANITA_TEMPLATE_ID = sid(8, 9103);
const RESULT_BPLO_ID = sid(9, 9101);
const RESULT_FIRE_FAIL_ID = sid(9, 9102);
const RESULT_SANITA_ID = sid(9, 9103);
const RESULT_FIRE_PASS_ID = sid(9, 9104);
const FINDING_ID = sid(10, 9101);
const CAP_ID = sid(11, 9101);
const CERTIFICATE_ID = sid(12, 9101);
const ISSUE_REPORT_ID = sid(13, 9101);
const DSR_ID = sid(18, 9101);
const ATTACHMENT_ID = sid(17, 9101);
const NOTIFICATION_ASSIGN_ID = sid(16, 9101);
const NOTIFICATION_CAP_ID = sid(16, 9102);
const NOTIFICATION_CERT_ID = sid(16, 9103);

const ADMIN_USER_ID = sid(4, 9101);
const LGU_ADMIN_USER_ID = sid(4, 9102);
const SUPERVISOR_USER_ID = sid(4, 9103);
const CLERK_USER_ID = sid(4, 9104);
const INSPECTOR_USER_ID = sid(4, 9105);
const OWNER_USER_ID = sid(4, 9106);
const CITIZEN_USER_ID = sid(4, 9107);

const AUDIT_IDS = Array.from({ length: 8 }, (_, index) =>
  sid(15, 9101 + index),
);

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const lgu = await prisma.lgu.upsert({
    where: { code: "SCN-TUG" },
    update: {
      city: "Tuguegarao City",
      name: "Tuguegarao City Scenario LGU",
      province: "Cagayan",
      region: "Region II",
    },
    create: {
      id: LGU_ID,
      code: "SCN-TUG",
      name: "Tuguegarao City Scenario LGU",
      region: "Region II",
      province: "Cagayan",
      city: "Tuguegarao City",
    },
  });

  const modules = [
    {
      code: "BPLO",
      name: "Business Permit Licensing Office",
      description: "Business permit inspection operations",
    },
    {
      code: "FIRE",
      name: "FireGuard Inspect",
      description: "Fire safety inspection operations",
    },
    {
      code: "SANITA",
      name: "SanitaCheck Inspect",
      description: "Sanitation and health inspections",
    },
  ];

  for (const moduleDef of modules) {
    await prisma.module.upsert({
      where: { code: moduleDef.code },
      update: {
        description: moduleDef.description,
        isActive: true,
        name: moduleDef.name,
      },
      create: {
        code: moduleDef.code,
        description: moduleDef.description,
        isActive: true,
        name: moduleDef.name,
      },
    });
  }

  const moduleRows = await prisma.module.findMany({
    where: { code: { in: modules.map((moduleDef) => moduleDef.code) } },
    select: { code: true, id: true },
  });
  const moduleByCode = Object.fromEntries(
    moduleRows.map((moduleRow) => [moduleRow.code, moduleRow.id]),
  );

  const office = await prisma.office.upsert({
    where: { lguId_code: { lguId: lgu.id, code: "BPLO-RFH" } },
    update: {
      description:
        "Scenario office for Riverside Food Hub permit, fire, and sanitation workflows.",
      name: "BPLO Riverside Scenario Office",
    },
    create: {
      id: OFFICE_ID,
      lguId: lgu.id,
      code: "BPLO-RFH",
      name: "BPLO Riverside Scenario Office",
      description:
        "Scenario office for Riverside Food Hub permit, fire, and sanitation workflows.",
    },
  });

  for (const moduleCode of ["BPLO", "FIRE", "SANITA"]) {
    await prisma.officeModule.upsert({
      where: {
        officeId_moduleId: {
          officeId: office.id,
          moduleId: moduleByCode[moduleCode],
        },
      },
      update: {},
      create: {
        officeId: office.id,
        moduleId: moduleByCode[moduleCode],
      },
    });
  }

  const users = [
    {
      id: ADMIN_USER_ID,
      email: "admin-role-scenario@inspectph.dev",
      name: "Patricia Gomez",
      role: "ADMIN",
    },
    {
      id: LGU_ADMIN_USER_ID,
      email: "lgu-admin-riverside@inspectph.dev",
      name: "Lorenzo Mendoza",
      role: "LGU_ADMIN",
      lguId: lgu.id,
    },
    {
      id: SUPERVISOR_USER_ID,
      email: "supervisor-riverside@inspectph.dev",
      name: "Elena Villaflor",
      role: "OFFICE_SUPERVISOR",
      lguId: lgu.id,
    },
    {
      id: CLERK_USER_ID,
      email: "clerk-riverside@inspectph.dev",
      name: "Marvin Castillo",
      role: "OFFICE_CLERK",
      lguId: lgu.id,
    },
    {
      id: INSPECTOR_USER_ID,
      email: "inspector-riverside@inspectph.dev",
      name: "Rhea Padilla",
      role: "INSPECTOR",
      lguId: lgu.id,
    },
    {
      id: OWNER_USER_ID,
      email: "owner-riverside@inspectph.dev",
      name: "Miguel Santos",
      role: "BUSINESS_OWNER",
    },
    {
      id: CITIZEN_USER_ID,
      email: "citizen-riverside@inspectph.dev",
      name: "Ana Lopez",
      role: "CITIZEN",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        lguId: user.lguId ?? null,
        name: user.name,
        passwordHash,
        role: user.role as never,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role as never,
        lguId: user.lguId ?? null,
      },
    });
  }

  const userRows = await prisma.user.findMany({
    where: { email: { in: users.map((user) => user.email) } },
    select: { email: true, id: true },
  });
  const userByEmail = Object.fromEntries(
    userRows.map((userRow) => [userRow.email, userRow.id]),
  );

  const supervisorId = userByEmail["supervisor-riverside@inspectph.dev"];
  const clerkId = userByEmail["clerk-riverside@inspectph.dev"];
  const inspectorId = userByEmail["inspector-riverside@inspectph.dev"];
  const ownerId = userByEmail["owner-riverside@inspectph.dev"];
  const citizenId = userByEmail["citizen-riverside@inspectph.dev"];
  const adminId = userByEmail["admin-role-scenario@inspectph.dev"];
  const lguAdminId = userByEmail["lgu-admin-riverside@inspectph.dev"];

  for (const userId of [supervisorId, clerkId, inspectorId]) {
    await prisma.userOfficeAssignment.upsert({
      where: { userId_officeId: { userId, officeId: office.id } },
      update: {},
      create: { userId, officeId: office.id },
    });
  }

  const business = await prisma.businessEstablishment.upsert({
    where: { id: BUSINESS_ID },
    update: {
      addressLine: "18 Riverside Extension",
      barangay: "Centro 08",
      businessName: "Riverside Food Hub",
      city: "Tuguegarao City",
      contactNumber: "+63 917 812 4400",
      ownerName: "Miguel Santos",
      province: "Cagayan",
      tradeName: "Riverside Food Hub",
    },
    create: {
      id: BUSINESS_ID,
      businessName: "Riverside Food Hub",
      tradeName: "Riverside Food Hub",
      ownerName: "Miguel Santos",
      addressLine: "18 Riverside Extension",
      barangay: "Centro 08",
      city: "Tuguegarao City",
      province: "Cagayan",
      contactNumber: "+63 917 812 4400",
      taxIdentificationNumber: "221-908-445-000",
    },
  });

  await prisma.user.update({
    where: { id: ownerId },
    data: { businessId: business.id },
  });

  const permit = await prisma.permitRecord.upsert({
    where: { permitNumber: "SCN-TUG-2026-0001" },
    update: {
      applicationDate: new Date("2026-04-20T08:00:00.000Z"),
      businessId: business.id,
      createdById: clerkId,
      expirationDate: new Date("2027-05-31T23:59:59.000Z"),
      lineOfBusiness: "Restaurant and food service",
      status: "APPROVED",
    },
    create: {
      id: PERMIT_ID,
      businessId: business.id,
      permitNumber: "SCN-TUG-2026-0001",
      applicationDate: new Date("2026-04-20T08:00:00.000Z"),
      expirationDate: new Date("2027-05-31T23:59:59.000Z"),
      lineOfBusiness: "Restaurant and food service",
      status: "APPROVED",
      createdById: clerkId,
    },
  });

  await prisma.paymentRecord.upsert({
    where: { referenceNumber: "SCN-PAY-2026-0001" },
    update: {
      amountInMinor: 125000,
      description: "Renewal payment for Riverside Food Hub",
      paidAt: new Date("2026-04-22T10:15:00.000Z"),
      permitRecordId: permit.id,
      provider: "PAYMONGO",
      receiptNumber: "SCN-RCPT-2026-0001",
      status: "PAID",
    },
    create: {
      id: PAYMENT_ID,
      permitRecordId: permit.id,
      referenceNumber: "SCN-PAY-2026-0001",
      provider: "PAYMONGO",
      amountInMinor: 125000,
      currency: "PHP",
      status: "PAID",
      description: "Renewal payment for Riverside Food Hub",
      paidAt: new Date("2026-04-22T10:15:00.000Z"),
      receiptNumber: "SCN-RCPT-2026-0001",
    },
  });

  const templates = [
    {
      id: BPLO_TEMPLATE_ID,
      code: "SCN-BPLO-001",
      description:
        "Business permit, posted license, and operating-hours controls.",
      module: "BPLO",
      sortOrder: 1,
      title: "Riverside permit compliance",
    },
    {
      id: FIRE_TEMPLATE_ID,
      code: "SCN-FIRE-001",
      description:
        "Rear exit access, extinguisher servicing, and illuminated signage.",
      module: "FIRE",
      sortOrder: 2,
      title: "Riverside fire safety check",
    },
    {
      id: SANITA_TEMPLATE_ID,
      code: "SCN-SANITA-001",
      description:
        "Kitchen sanitation, waste segregation, and smoke extraction.",
      module: "SANITA",
      sortOrder: 3,
      title: "Riverside sanitation check",
    },
  ];

  for (const template of templates) {
    await prisma.checklistTemplate.upsert({
      where: { code: template.code },
      update: {
        description: template.description,
        isActive: true,
        module: template.module,
        sortOrder: template.sortOrder,
        title: template.title,
        version: 1,
      },
      create: {
        id: template.id,
        code: template.code,
        module: template.module,
        title: template.title,
        description: template.description,
        sortOrder: template.sortOrder,
        isActive: true,
        version: 1,
        lguId: lgu.id,
        publishedAt: new Date("2026-04-18T08:00:00.000Z"),
      },
    });
  }

  const initialInspection = await prisma.inspection.upsert({
    where: { id: INITIAL_INSPECTION_ID },
    update: {
      businessId: business.id,
      completedAt: new Date("2026-05-02T11:30:00.000Z"),
      inspectorId,
      locationAccuracyMeters: 4,
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      moduleCode: "FIRE",
      notes:
        "Initial renewal inspection found the rear exit partially blocked by LPG canisters.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-02T09:00:00.000Z"),
      startedAt: new Date("2026-05-02T09:12:00.000Z"),
      status: "COMPLETED",
    },
    create: {
      id: INITIAL_INSPECTION_ID,
      businessId: business.id,
      permitRecordId: permit.id,
      officeId: office.id,
      inspectorId,
      moduleCode: "FIRE",
      scheduledAt: new Date("2026-05-02T09:00:00.000Z"),
      startedAt: new Date("2026-05-02T09:12:00.000Z"),
      completedAt: new Date("2026-05-02T11:30:00.000Z"),
      status: "COMPLETED",
      notes:
        "Initial renewal inspection found the rear exit partially blocked by LPG canisters.",
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      locationAccuracyMeters: 4,
    },
  });

  const followUpInspection = await prisma.inspection.upsert({
    where: { id: FOLLOW_UP_INSPECTION_ID },
    update: {
      businessId: business.id,
      completedAt: new Date("2026-05-16T10:20:00.000Z"),
      inspectorId,
      locationAccuracyMeters: 5,
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      moduleCode: "FIRE",
      notes:
        "Follow-up inspection confirmed exit clearance and compliant signage.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-05-16T08:30:00.000Z"),
      startedAt: new Date("2026-05-16T08:42:00.000Z"),
      status: "COMPLETED",
    },
    create: {
      id: FOLLOW_UP_INSPECTION_ID,
      businessId: business.id,
      permitRecordId: permit.id,
      officeId: office.id,
      inspectorId,
      moduleCode: "FIRE",
      scheduledAt: new Date("2026-05-16T08:30:00.000Z"),
      startedAt: new Date("2026-05-16T08:42:00.000Z"),
      completedAt: new Date("2026-05-16T10:20:00.000Z"),
      status: "COMPLETED",
      notes:
        "Follow-up inspection confirmed exit clearance and compliant signage.",
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      locationAccuracyMeters: 5,
    },
  });

  const upcomingInspection = await prisma.inspection.upsert({
    where: { id: UPCOMING_INSPECTION_ID },
    update: {
      businessId: business.id,
      inspectorId,
      moduleCode: "SANITA",
      notes:
        "Routine post-renewal sanitation review for peak season operations.",
      officeId: office.id,
      permitRecordId: permit.id,
      scheduledAt: new Date("2026-11-20T09:30:00.000Z"),
      status: "SCHEDULED",
    },
    create: {
      id: UPCOMING_INSPECTION_ID,
      businessId: business.id,
      permitRecordId: permit.id,
      officeId: office.id,
      inspectorId,
      moduleCode: "SANITA",
      scheduledAt: new Date("2026-11-20T09:30:00.000Z"),
      status: "SCHEDULED",
      notes:
        "Routine post-renewal sanitation review for peak season operations.",
    },
  });

  await prisma.inspectionChecklistResult.upsert({
    where: {
      inspectionId_templateId: {
        inspectionId: initialInspection.id,
        templateId: BPLO_TEMPLATE_ID,
      },
    },
    update: {
      remarks:
        "Posted permit and operating hours were visible at the entrance.",
      status: "PASS",
      templateVersion: 1,
    },
    create: {
      id: RESULT_BPLO_ID,
      inspectionId: initialInspection.id,
      templateId: BPLO_TEMPLATE_ID,
      status: "PASS",
      remarks:
        "Posted permit and operating hours were visible at the entrance.",
      templateVersion: 1,
    },
  });

  await prisma.inspectionChecklistResult.upsert({
    where: {
      inspectionId_templateId: {
        inspectionId: initialInspection.id,
        templateId: FIRE_TEMPLATE_ID,
      },
    },
    update: {
      remarks:
        "Rear exit was partially blocked and extinguisher clearance was below required spacing.",
      status: "FAIL",
      templateVersion: 1,
    },
    create: {
      id: RESULT_FIRE_FAIL_ID,
      inspectionId: initialInspection.id,
      templateId: FIRE_TEMPLATE_ID,
      status: "FAIL",
      remarks:
        "Rear exit was partially blocked and extinguisher clearance was below required spacing.",
      templateVersion: 1,
    },
  });

  await prisma.inspectionChecklistResult.upsert({
    where: {
      inspectionId_templateId: {
        inspectionId: initialInspection.id,
        templateId: SANITA_TEMPLATE_ID,
      },
    },
    update: {
      remarks:
        "Kitchen sanitation and waste segregation were acceptable during the visit.",
      status: "PASS",
      templateVersion: 1,
    },
    create: {
      id: RESULT_SANITA_ID,
      inspectionId: initialInspection.id,
      templateId: SANITA_TEMPLATE_ID,
      status: "PASS",
      remarks:
        "Kitchen sanitation and waste segregation were acceptable during the visit.",
      templateVersion: 1,
    },
  });

  await prisma.inspectionChecklistResult.upsert({
    where: {
      inspectionId_templateId: {
        inspectionId: followUpInspection.id,
        templateId: FIRE_TEMPLATE_ID,
      },
    },
    update: {
      remarks:
        "Rear exit is clear and emergency signage is illuminated after corrective work.",
      status: "PASS",
      templateVersion: 1,
    },
    create: {
      id: RESULT_FIRE_PASS_ID,
      inspectionId: followUpInspection.id,
      templateId: FIRE_TEMPLATE_ID,
      status: "PASS",
      remarks:
        "Rear exit is clear and emergency signage is illuminated after corrective work.",
      templateVersion: 1,
    },
  });

  await prisma.finding.upsert({
    where: { id: FINDING_ID },
    update: {
      checklistResultId: RESULT_FIRE_FAIL_ID,
      correctiveAction:
        "Remove LPG canisters from the egress path and maintain a clear 1-meter exit lane at all times.",
      description:
        "Rear exit access was obstructed by stacked LPG canisters and a delivery rack during the inspection.",
      dueDate: new Date("2026-05-12T23:59:59.000Z"),
      inspectionId: initialInspection.id,
      locationAccuracyMeters: 4,
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      resolvedAt: new Date("2026-05-15T14:00:00.000Z"),
      severity: "HIGH",
      title: "Rear exit blocked by LPG storage",
    },
    create: {
      id: FINDING_ID,
      inspectionId: initialInspection.id,
      checklistResultId: RESULT_FIRE_FAIL_ID,
      severity: "HIGH",
      title: "Rear exit blocked by LPG storage",
      description:
        "Rear exit access was obstructed by stacked LPG canisters and a delivery rack during the inspection.",
      correctiveAction:
        "Remove LPG canisters from the egress path and maintain a clear 1-meter exit lane at all times.",
      dueDate: new Date("2026-05-12T23:59:59.000Z"),
      resolvedAt: new Date("2026-05-15T14:00:00.000Z"),
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      locationAccuracyMeters: 4,
    },
  });

  await prisma.correctiveActionPlan.upsert({
    where: { findingId: FINDING_ID },
    update: {
      businessId: business.id,
      deadlineAt: new Date("2026-05-12T23:59:59.000Z"),
      description:
        "Clear the rear exit, repaint the exit path marker, and keep cylinders in the secured storage cage.",
      inspectionId: initialInspection.id,
      resolvedAt: new Date("2026-05-15T14:00:00.000Z"),
      responseNote:
        "Owner moved cylinders to the storage cage and uploaded follow-up photos before reinspection.",
      status: "RESOLVED",
    },
    create: {
      id: CAP_ID,
      findingId: FINDING_ID,
      inspectionId: initialInspection.id,
      businessId: business.id,
      description:
        "Clear the rear exit, repaint the exit path marker, and keep cylinders in the secured storage cage.",
      deadlineAt: new Date("2026-05-12T23:59:59.000Z"),
      status: "RESOLVED",
      responseNote:
        "Owner moved cylinders to the storage cage and uploaded follow-up photos before reinspection.",
      resolvedAt: new Date("2026-05-15T14:00:00.000Z"),
    },
  });

  await prisma.attachment.upsert({
    where: {
      storageKey:
        "scenario/riverside-food-hub/initial-inspection/rear-exit-blocked.jpg",
    },
    update: {
      capturedAt: new Date("2026-05-02T09:48:00.000Z"),
      fileName: "rear-exit-blocked.jpg",
      fileSizeBytes: 1382400,
      findingId: FINDING_ID,
      inspectionId: initialInspection.id,
      locationAccuracyMeters: 4,
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      mimeType: "image/jpeg",
    },
    create: {
      id: ATTACHMENT_ID,
      inspectionId: initialInspection.id,
      findingId: FINDING_ID,
      fileName: "rear-exit-blocked.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1382400,
      storageKey:
        "scenario/riverside-food-hub/initial-inspection/rear-exit-blocked.jpg",
      capturedAt: new Date("2026-05-02T09:48:00.000Z"),
      locationLatitude: 17.6138,
      locationLongitude: 121.7265,
      locationAccuracyMeters: 4,
    },
  });

  await prisma.fireSafetyCertificate.upsert({
    where: { inspectionId: followUpInspection.id },
    update: {
      certificateNumber: "FSIC-SCN-TUG-2026-0001",
      expiresAt: new Date("2027-05-16T23:59:59.000Z"),
      issuedAt: new Date("2026-05-16T13:00:00.000Z"),
      remarks:
        "Issued after compliant reinspection of the corrected rear exit and fire path.",
      status: "ISSUED",
      verificationUrl: "https://inspect.ph/verify/FSIC-SCN-TUG-2026-0001",
    },
    create: {
      id: CERTIFICATE_ID,
      inspectionId: followUpInspection.id,
      certificateNumber: "FSIC-SCN-TUG-2026-0001",
      issuedAt: new Date("2026-05-16T13:00:00.000Z"),
      expiresAt: new Date("2027-05-16T23:59:59.000Z"),
      status: "ISSUED",
      remarks:
        "Issued after compliant reinspection of the corrected rear exit and fire path.",
      verificationUrl: "https://inspect.ph/verify/FSIC-SCN-TUG-2026-0001",
    },
  });

  await prisma.issueReport.upsert({
    where: { reportNumber: "IR-SCN-TUG-0001" },
    update: {
      category: "FIRE_HAZARD",
      description:
        "Smoke from the service alley is still noticeable during peak hours near the shared walkway.",
      locationDescription: "Rear service alley beside Riverside Food Hub",
      reporterEmail: "citizen-riverside@inspectph.dev",
      reporterName: "Ana Lopez",
      reporterPhone: "+63 919 770 8811",
      reporterUserId: citizenId,
      status: "SUBMITTED",
      subject: "Smoke accumulation in service alley",
    },
    create: {
      id: ISSUE_REPORT_ID,
      reportNumber: "IR-SCN-TUG-0001",
      reporterUserId: citizenId,
      category: "FIRE_HAZARD",
      subject: "Smoke accumulation in service alley",
      description:
        "Smoke from the service alley is still noticeable during peak hours near the shared walkway.",
      locationDescription: "Rear service alley beside Riverside Food Hub",
      reporterName: "Ana Lopez",
      reporterEmail: "citizen-riverside@inspectph.dev",
      reporterPhone: "+63 919 770 8811",
      status: "SUBMITTED",
      locationLatitude: 17.6136,
      locationLongitude: 121.7262,
      locationAccuracyMeters: 18,
    },
  });

  await prisma.dataSubjectRequest.upsert({
    where: { id: DSR_ID },
    update: {
      description:
        "Please provide a copy of my account profile and permit-related activity for Riverside Food Hub.",
      email: "owner-riverside@inspectph.dev",
      requestedByUserId: ownerId,
      status: "PENDING",
      type: "ACCESS",
    },
    create: {
      id: DSR_ID,
      type: "ACCESS",
      status: "PENDING",
      requestedByUserId: ownerId,
      email: "owner-riverside@inspectph.dev",
      description:
        "Please provide a copy of my account profile and permit-related activity for Riverside Food Hub.",
    },
  });

  const notifications = [
    {
      id: NOTIFICATION_ASSIGN_ID,
      recipientUserId: inspectorId,
      channel: "IN_APP" as const,
      eventType: "inspection.assigned",
      title: "Inspection assigned",
      body: "You have been assigned to inspect Riverside Food Hub for permit renewal.",
      entityType: "inspection",
      entityId: INITIAL_INSPECTION_ID,
      status: "PROCESSED" as const,
    },
    {
      id: NOTIFICATION_CAP_ID,
      recipientUserId: ownerId,
      channel: "IN_APP" as const,
      eventType: "inspection.status_updated",
      title: "Corrective action required",
      body: "A CAP was issued for the blocked rear exit finding at Riverside Food Hub.",
      entityType: "inspection",
      entityId: INITIAL_INSPECTION_ID,
      status: "PROCESSED" as const,
    },
    {
      id: NOTIFICATION_CERT_ID,
      recipientUserId: ownerId,
      channel: "IN_APP" as const,
      eventType: "inspection.status_updated",
      title: "Certificate issued",
      body: "Your follow-up inspection passed and the fire safety certificate is now available.",
      entityType: "inspection",
      entityId: FOLLOW_UP_INSPECTION_ID,
      status: "PROCESSED" as const,
    },
  ];

  for (const notification of notifications) {
    await prisma.notificationOutbox.upsert({
      where: { id: notification.id },
      update: notification,
      create: notification,
    });
  }

  const auditLogs = [
    {
      id: AUDIT_IDS[0],
      actorRole: "OFFICE_CLERK",
      actorUserId: clerkId,
      action: "inspection.created",
      entityId: INITIAL_INSPECTION_ID,
      entityType: "inspection",
      summary: "Clerk prepared the Riverside Food Hub inspection work item.",
      detail: "Permit renewal inspection created after fee verification.",
    },
    {
      id: AUDIT_IDS[1],
      actorRole: "OFFICE_SUPERVISOR",
      actorUserId: supervisorId,
      action: "inspection.assigned",
      entityId: INITIAL_INSPECTION_ID,
      entityType: "inspection",
      summary: "Supervisor assigned the initial Riverside Food Hub inspection.",
      detail: "Assigned to inspector Rhea Padilla.",
    },
    {
      id: AUDIT_IDS[2],
      actorRole: "INSPECTOR",
      actorUserId: inspectorId,
      action: "inspection.status_updated",
      entityId: INITIAL_INSPECTION_ID,
      entityType: "inspection",
      summary: "Initial inspection completed with one high-severity finding.",
      detail: "Rear exit obstruction documented with photo evidence.",
    },
    {
      id: AUDIT_IDS[3],
      actorRole: "INSPECTOR",
      actorUserId: inspectorId,
      action: "finding.created",
      entityId: FINDING_ID,
      entityType: "finding",
      summary: "Inspector recorded a blocked rear exit finding.",
      detail: "CAP required before renewal could proceed.",
    },
    {
      id: AUDIT_IDS[4],
      actorRole: "OFFICE_SUPERVISOR",
      actorUserId: supervisorId,
      action: "cap.created",
      entityId: CAP_ID,
      entityType: "cap",
      summary: "Supervisor issued a CAP for the blocked exit finding.",
      detail: "Owner was instructed to clear the exit and secure LPG storage.",
    },
    {
      id: AUDIT_IDS[5],
      actorRole: "BUSINESS_OWNER",
      actorUserId: ownerId,
      action: "reinspection.requested",
      entityId: FOLLOW_UP_INSPECTION_ID,
      entityType: "inspection",
      summary: "Business owner requested reinspection after CAP completion.",
      detail: "Follow-up photos were submitted before scheduling.",
    },
    {
      id: AUDIT_IDS[6],
      actorRole: "OFFICE_SUPERVISOR",
      actorUserId: supervisorId,
      action: "certificate.issued",
      entityId: CERTIFICATE_ID,
      entityType: "certificate",
      summary: "Supervisor issued the Riverside Food Hub FSIC.",
      detail:
        "Follow-up inspection passed without remaining fire-safety findings.",
    },
    {
      id: AUDIT_IDS[7],
      actorRole: "PAYMENT_STATUS_UPDATED" as never,
      actorUserId: undefined,
      action: "payment.status_updated",
      entityId: PAYMENT_ID,
      entityType: "payment",
      summary: "Renewal payment settled for Riverside Food Hub.",
      detail: "PayMongo payment marked as paid before inspection scheduling.",
    },
  ];

  for (const auditLog of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: auditLog.id },
      update: {
        action: auditLog.action,
        actorRole:
          auditLog.id === AUDIT_IDS[7] ? null : (auditLog.actorRole as never),
        actorUserId: auditLog.actorUserId ?? null,
        detail: auditLog.detail,
        entityId: auditLog.entityId,
        entityType: auditLog.entityType,
        summary: auditLog.summary,
      },
      create: {
        id: auditLog.id,
        action: auditLog.action,
        actorRole:
          auditLog.id === AUDIT_IDS[7] ? null : (auditLog.actorRole as never),
        actorUserId: auditLog.actorUserId ?? null,
        detail: auditLog.detail,
        entityId: auditLog.entityId,
        entityType: auditLog.entityType,
        summary: auditLog.summary,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        command: "npm run seed:dev-role-scenario",
        credentials: users.map((user) => ({
          email: user.email,
          password: PASSWORD,
          role: user.role,
        })),
        lgu: { code: "SCN-TUG", id: lgu.id, name: lgu.name },
        office: { code: office.code, id: office.id, name: office.name },
        business: {
          id: business.id,
          name: business.businessName,
          ownerEmail: "owner-riverside@inspectph.dev",
        },
        permit: {
          id: permit.id,
          paymentReference: "SCN-PAY-2026-0001",
          permitNumber: permit.permitNumber,
          status: permit.status,
        },
        inspections: [
          {
            id: initialInspection.id,
            status: initialInspection.status,
            type: "initial_failed",
          },
          {
            id: followUpInspection.id,
            status: followUpInspection.status,
            type: "follow_up_passed",
          },
          {
            id: upcomingInspection.id,
            status: upcomingInspection.status,
            type: "upcoming_scheduled",
          },
        ],
        issueReportNumber: "IR-SCN-TUG-0001",
        certificateNumber: "FSIC-SCN-TUG-2026-0001",
        privacyRequestId: DSR_ID,
        adminUsers: [adminId, lguAdminId],
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
