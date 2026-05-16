import "../env.js";

import { prisma } from "../lib/prisma.js";

const AGRI_MODULE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567804";

const CHECKLIST_ITEMS = [
  {
    code: "AGRI-PESTICIDE-001",
    title: "Pesticide storage and handling",
    description: "Verify pesticides are stored in a locked facility with proper labeling and MSDS",
    sortOrder: 1,
  },
  {
    code: "AGRI-IRRIGATION-001",
    title: "Irrigation system compliance",
    description: "Check irrigation water sources, delivery systems, and runoff containment",
    sortOrder: 2,
  },
  {
    code: "AGRI-SANITATION-001",
    title: "Worker sanitation facilities",
    description: "Inspect potable water access, latrines, and handwashing stations for farm workers",
    sortOrder: 3,
  },
  {
    code: "AGRI-ORGANIC-001",
    title: "Organic certification compliance",
    description: "Confirm organic input logs and buffer zones when organic certification is claimed",
    sortOrder: 4,
  },
  {
    code: "AGRI-POSTHARVEST-001",
    title: "Post-harvest handling and storage",
    description: "Inspect produce washing, grading, and cold-chain facilities for hygiene",
    sortOrder: 5,
  },
];

async function main() {
  await prisma.module.upsert({
    where: { id: AGRI_MODULE_ID },
    update: {
      code: "AGRI",
      description: "Agricultural compliance and farm inspection operations",
      isActive: true,
      name: "AgriCheck PH",
    },
    create: {
      id: AGRI_MODULE_ID,
      code: "AGRI",
      description: "Agricultural compliance and farm inspection operations",
      isActive: true,
      name: "AgriCheck PH",
    },
  });

  for (const item of CHECKLIST_ITEMS) {
    await prisma.checklistTemplate.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        description: item.description,
        module: "AGRI",
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        code: item.code,
        title: item.title,
        description: item.description,
        module: "AGRI",
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("AgriCheck PH module and checklist templates seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
