import "../env.js";

import { prisma } from "../lib/prisma.js";

const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";

const TMPL_BPLO_GENERAL_ID = "c1d2e3f4-0001-4000-8000-000000000001";
const TMPL_FIRE_SAFETY_ID = "c1d2e3f4-0002-4000-8000-000000000002";
const TMPL_SANITATION_ID = "c1d2e3f4-0003-4000-8000-000000000003";
const TMPL_BUILDING_ID = "c1d2e3f4-0004-4000-8000-000000000004";
const TMPL_MARKETPLACE_ID = "c1d2e3f4-0005-4000-8000-000000000005";

async function main() {
  const lgu = await prisma.lgu.findUnique({ where: { id: DEV_LGU_ID } });

  if (!lgu) {
    throw new Error(
      "Dev LGU was not found. Run npm run seed:dev-inspections first.",
    );
  }

  const bplo = await prisma.checklistTemplate.upsert({
    where: { id: TMPL_BPLO_GENERAL_ID },
    update: {
      code: "BPLO-GEN-V1",
      description:
        "General BPLO business permit inspection covering basic compliance requirements.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "BPLO",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      sortOrder: 1,
      title: "BPLO General Permit Inspection",
      version: 1,
    },
    create: {
      id: TMPL_BPLO_GENERAL_ID,
      code: "BPLO-GEN-V1",
      description:
        "General BPLO business permit inspection covering basic compliance requirements.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "BPLO",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      sortOrder: 1,
      title: "BPLO General Permit Inspection",
      version: 1,
    },
  });

  const fire = await prisma.checklistTemplate.upsert({
    where: { id: TMPL_FIRE_SAFETY_ID },
    update: {
      code: "FIRE-SAFETY-V2",
      description:
        "Fire safety compliance checklist for commercial and industrial establishments.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "FIRE",
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
      sortOrder: 2,
      title: "Fire Safety Compliance Inspection",
      version: 2,
    },
    create: {
      id: TMPL_FIRE_SAFETY_ID,
      code: "FIRE-SAFETY-V2",
      description:
        "Fire safety compliance checklist for commercial and industrial establishments.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "FIRE",
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
      sortOrder: 2,
      title: "Fire Safety Compliance Inspection",
      version: 2,
    },
  });

  const sanitation = await prisma.checklistTemplate.upsert({
    where: { id: TMPL_SANITATION_ID },
    update: {
      code: "SANIT-FOOD-V1",
      description:
        "Sanitation and hygiene checklist for food service establishments and public markets.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "SANITATION",
      publishedAt: new Date("2026-01-20T00:00:00.000Z"),
      sortOrder: 3,
      title: "Food Service Sanitation Inspection",
      version: 1,
    },
    create: {
      id: TMPL_SANITATION_ID,
      code: "SANIT-FOOD-V1",
      description:
        "Sanitation and hygiene checklist for food service establishments and public markets.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "SANITATION",
      publishedAt: new Date("2026-01-20T00:00:00.000Z"),
      sortOrder: 3,
      title: "Food Service Sanitation Inspection",
      version: 1,
    },
  });

  const building = await prisma.checklistTemplate.upsert({
    where: { id: TMPL_BUILDING_ID },
    update: {
      code: "BUILD-STRUCT-V1",
      description:
        "Structural integrity and building code compliance for commercial buildings.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "BUILDING",
      publishedAt: new Date("2026-03-01T00:00:00.000Z"),
      sortOrder: 4,
      title: "Building Code Structural Inspection",
      version: 1,
    },
    create: {
      id: TMPL_BUILDING_ID,
      code: "BUILD-STRUCT-V1",
      description:
        "Structural integrity and building code compliance for commercial buildings.",
      isActive: true,
      isMarketplace: false,
      lguId: lgu.id,
      module: "BUILDING",
      publishedAt: new Date("2026-03-01T00:00:00.000Z"),
      sortOrder: 4,
      title: "Building Code Structural Inspection",
      version: 1,
    },
  });

  // Marketplace template — not scoped to a specific LGU
  const marketplace = await prisma.checklistTemplate.upsert({
    where: { id: TMPL_MARKETPLACE_ID },
    update: {
      code: "MKT-BPLO-STANDARD-V1",
      description:
        "Community-contributed standard BPLO template suitable for general-purpose LGU adoption.",
      isActive: true,
      isMarketplace: true,
      module: "BPLO",
      publishedAt: new Date("2026-04-01T00:00:00.000Z"),
      sortOrder: 10,
      title: "Standard BPLO Inspection (Marketplace)",
      version: 1,
    },
    create: {
      id: TMPL_MARKETPLACE_ID,
      code: "MKT-BPLO-STANDARD-V1",
      description:
        "Community-contributed standard BPLO template suitable for general-purpose LGU adoption.",
      isActive: true,
      isMarketplace: true,
      module: "BPLO",
      publishedAt: new Date("2026-04-01T00:00:00.000Z"),
      sortOrder: 10,
      title: "Standard BPLO Inspection (Marketplace)",
      version: 1,
    },
  });

  console.log(
    JSON.stringify(
      {
        checklistTemplates: [bplo, fire, sanitation, building, marketplace].map(
          (t) => ({
            id: t.id,
            code: t.code,
            isMarketplace: t.isMarketplace,
            module: t.module,
            title: t.title,
            version: t.version,
          }),
        ),
        lguId: lgu.id,
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
