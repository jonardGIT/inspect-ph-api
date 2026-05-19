import "../env.js";

import { prisma } from "../lib/prisma.js";

const INSPECTOR_EMAIL = "inspector@example.com";

const REPORT_FIRE_ID = "b1c2d3e4-0001-4000-8000-000000000001";
const REPORT_SANITATION_ID = "b1c2d3e4-0002-4000-8000-000000000002";
const REPORT_STRUCTURAL_ID = "b1c2d3e4-0003-4000-8000-000000000003";
const REPORT_SAFETY_ID = "b1c2d3e4-0004-4000-8000-000000000004";

async function main() {
  const inspector = await prisma.user.findUnique({
    where: { email: INSPECTOR_EMAIL },
  });

  if (!inspector) {
    throw new Error(
      "Inspector user was not found. Run npm run seed:dev-inspector first.",
    );
  }

  const fire = await prisma.issueReport.upsert({
    where: { id: REPORT_FIRE_ID },
    update: {
      category: "FIRE_HAZARD",
      description:
        "Electrical wiring near combustible storage observed during routine walk-through. No fire extinguisher visible within 10 metres.",
      locationDescription: "Ground floor, Warehouse Section B, Tuguegarao City",
      locationLatitude: 17.6134,
      locationLongitude: 121.7268,
      reportNumber: "IR-DEV-2026-0001",
      reporterEmail: inspector.email,
      reporterName: inspector.name,
      reporterUserId: inspector.id,
      status: "UNDER_REVIEW",
      subject: "Exposed electrical wiring near fuel drums",
    },
    create: {
      id: REPORT_FIRE_ID,
      category: "FIRE_HAZARD",
      description:
        "Electrical wiring near combustible storage observed during routine walk-through. No fire extinguisher visible within 10 metres.",
      locationDescription: "Ground floor, Warehouse Section B, Tuguegarao City",
      locationLatitude: 17.6134,
      locationLongitude: 121.7268,
      reportNumber: "IR-DEV-2026-0001",
      reporterEmail: inspector.email,
      reporterName: inspector.name,
      reporterUserId: inspector.id,
      status: "UNDER_REVIEW",
      subject: "Exposed electrical wiring near fuel drums",
    },
  });

  const sanitation = await prisma.issueReport.upsert({
    where: { id: REPORT_SANITATION_ID },
    update: {
      category: "SANITATION",
      description:
        "Wastewater is being discharged directly into the drainage canal without treatment. Strong odour reported by neighbouring residents.",
      locationDescription: "Barangay Centro 8, Tuguegarao City",
      reportNumber: "IR-DEV-2026-0002",
      reporterEmail: "citizen@example.com",
      reporterName: "Anonymous Citizen",
      status: "SUBMITTED",
      subject: "Untreated wastewater discharge near canal",
    },
    create: {
      id: REPORT_SANITATION_ID,
      category: "SANITATION",
      description:
        "Wastewater is being discharged directly into the drainage canal without treatment. Strong odour reported by neighbouring residents.",
      locationDescription: "Barangay Centro 8, Tuguegarao City",
      reportNumber: "IR-DEV-2026-0002",
      reporterEmail: "citizen@example.com",
      reporterName: "Anonymous Citizen",
      status: "SUBMITTED",
      subject: "Untreated wastewater discharge near canal",
    },
  });

  const structural = await prisma.issueReport.upsert({
    where: { id: REPORT_STRUCTURAL_ID },
    update: {
      category: "STRUCTURAL",
      description:
        "Cracks observed on load-bearing columns on the 3rd floor. Building is currently occupied by office tenants.",
      locationDescription: "3rd floor, Cagayan Commerce Tower, Tuguegarao City",
      reportNumber: "IR-DEV-2026-0003",
      reporterEmail: inspector.email,
      reporterName: inspector.name,
      reporterUserId: inspector.id,
      status: "RESOLVED",
      subject: "Structural cracks on load-bearing columns",
    },
    create: {
      id: REPORT_STRUCTURAL_ID,
      category: "STRUCTURAL",
      description:
        "Cracks observed on load-bearing columns on the 3rd floor. Building is currently occupied by office tenants.",
      locationDescription: "3rd floor, Cagayan Commerce Tower, Tuguegarao City",
      reportNumber: "IR-DEV-2026-0003",
      reporterEmail: inspector.email,
      reporterName: inspector.name,
      reporterUserId: inspector.id,
      status: "RESOLVED",
      subject: "Structural cracks on load-bearing columns",
    },
  });

  const safety = await prisma.issueReport.upsert({
    where: { id: REPORT_SAFETY_ID },
    update: {
      category: "PUBLIC_SAFETY",
      description:
        "Broken manhole cover on the main road poses a fall hazard, especially at night when lighting is poor.",
      locationDescription: "Rizal Street near Overpass, Tuguegarao City",
      locationLatitude: 17.612,
      locationLongitude: 121.7255,
      reportNumber: "IR-DEV-2026-0004",
      reporterPhone: "+63 917 555 0199",
      status: "SUBMITTED",
      subject: "Broken manhole cover on Rizal Street",
    },
    create: {
      id: REPORT_SAFETY_ID,
      category: "PUBLIC_SAFETY",
      description:
        "Broken manhole cover on the main road poses a fall hazard, especially at night when lighting is poor.",
      locationDescription: "Rizal Street near Overpass, Tuguegarao City",
      locationLatitude: 17.612,
      locationLongitude: 121.7255,
      reportNumber: "IR-DEV-2026-0004",
      reporterPhone: "+63 917 555 0199",
      status: "SUBMITTED",
      subject: "Broken manhole cover on Rizal Street",
    },
  });

  console.log(
    JSON.stringify(
      {
        issueReports: [fire, sanitation, structural, safety].map((r) => ({
          id: r.id,
          category: r.category,
          reportNumber: r.reportNumber,
          status: r.status,
          subject: r.subject,
        })),
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
