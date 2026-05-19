import "../env.js";

import { prisma } from "../lib/prisma.js";

// References records created by seed-dev-inspections
const DEV_SCHEDULED_INSPECTION_ID = "251d8bd9-ffde-4d95-889f-fffdf2ce1085";
const DEV_BUSINESS_ID = "f15de43c-d0df-4324-a069-cfa5145a7a6a";

const DEV_FINDING_CRITICAL_ID = "d1e2f3a4-0001-4000-8000-000000000001";
const DEV_FINDING_MEDIUM_ID = "d1e2f3a4-0002-4000-8000-000000000002";
const DEV_CAP_OPEN_ID = "d1e2f3a4-0011-4000-8000-000000000001";
const DEV_CAP_ACKNOWLEDGED_ID = "d1e2f3a4-0012-4000-8000-000000000002";

async function main() {
  const inspection = await prisma.inspection.findUnique({
    where: { id: DEV_SCHEDULED_INSPECTION_ID },
  });

  if (!inspection) {
    throw new Error(
      "Dev inspection was not found. Run npm run seed:dev-inspections first.",
    );
  }

  const criticalFinding = await prisma.finding.upsert({
    where: { id: DEV_FINDING_CRITICAL_ID },
    update: {
      correctiveAction:
        "Install fire extinguishers rated at least 10 lbs ABC in every 50 sq m of floor area and train staff on usage.",
      description:
        "No functional fire extinguishers present on the ground floor. Exit signage is obstructed by shelving.",
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
      inspectionId: inspection.id,
      severity: "CRITICAL",
      title: "Missing fire extinguishers and obstructed exit signs",
    },
    create: {
      id: DEV_FINDING_CRITICAL_ID,
      correctiveAction:
        "Install fire extinguishers rated at least 10 lbs ABC in every 50 sq m of floor area and train staff on usage.",
      description:
        "No functional fire extinguishers present on the ground floor. Exit signage is obstructed by shelving.",
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
      inspectionId: inspection.id,
      severity: "CRITICAL",
      title: "Missing fire extinguishers and obstructed exit signs",
    },
  });

  const mediumFinding = await prisma.finding.upsert({
    where: { id: DEV_FINDING_MEDIUM_ID },
    update: {
      correctiveAction:
        "Clean drainage channels and install proper grease traps per sanitation code Sec. 4.2.",
      description:
        "Kitchen drainage channels have visible grease buildup. Drain covers are damaged and need replacement.",
      dueDate: new Date("2026-05-25T00:00:00.000Z"),
      inspectionId: inspection.id,
      severity: "MEDIUM",
      title: "Grease buildup in kitchen drainage",
    },
    create: {
      id: DEV_FINDING_MEDIUM_ID,
      correctiveAction:
        "Clean drainage channels and install proper grease traps per sanitation code Sec. 4.2.",
      description:
        "Kitchen drainage channels have visible grease buildup. Drain covers are damaged and need replacement.",
      dueDate: new Date("2026-05-25T00:00:00.000Z"),
      inspectionId: inspection.id,
      severity: "MEDIUM",
      title: "Grease buildup in kitchen drainage",
    },
  });

  const openCap = await prisma.correctiveActionPlan.upsert({
    where: { id: DEV_CAP_OPEN_ID },
    update: {
      businessId: DEV_BUSINESS_ID,
      deadlineAt: new Date("2026-06-01T00:00:00.000Z"),
      description:
        "Install compliant fire extinguishers in all required positions per RA 9514 and clear all blocked emergency exits.",
      findingId: criticalFinding.id,
      inspectionId: inspection.id,
      status: "OPEN",
    },
    create: {
      id: DEV_CAP_OPEN_ID,
      businessId: DEV_BUSINESS_ID,
      deadlineAt: new Date("2026-06-01T00:00:00.000Z"),
      description:
        "Install compliant fire extinguishers in all required positions per RA 9514 and clear all blocked emergency exits.",
      findingId: criticalFinding.id,
      inspectionId: inspection.id,
      status: "OPEN",
    },
  });

  const acknowledgedCap = await prisma.correctiveActionPlan.upsert({
    where: { id: DEV_CAP_ACKNOWLEDGED_ID },
    update: {
      businessId: DEV_BUSINESS_ID,
      deadlineAt: new Date("2026-05-25T00:00:00.000Z"),
      description:
        "Clean and repair kitchen drainage channels; install certified grease traps before the next sanitation inspection.",
      findingId: mediumFinding.id,
      inspectionId: inspection.id,
      responseNote:
        "Business owner acknowledged and scheduled plumber for May 20.",
      status: "ACKNOWLEDGED",
    },
    create: {
      id: DEV_CAP_ACKNOWLEDGED_ID,
      businessId: DEV_BUSINESS_ID,
      deadlineAt: new Date("2026-05-25T00:00:00.000Z"),
      description:
        "Clean and repair kitchen drainage channels; install certified grease traps before the next sanitation inspection.",
      findingId: mediumFinding.id,
      inspectionId: inspection.id,
      responseNote:
        "Business owner acknowledged and scheduled plumber for May 20.",
      status: "ACKNOWLEDGED",
    },
  });

  console.log(
    JSON.stringify(
      {
        caps: [openCap, acknowledgedCap].map((c) => ({
          id: c.id,
          deadlineAt: c.deadlineAt?.toISOString(),
          findingId: c.findingId,
          status: c.status,
        })),
        findings: [criticalFinding, mediumFinding].map((f) => ({
          id: f.id,
          severity: f.severity,
          title: f.title,
        })),
        inspectionId: inspection.id,
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
