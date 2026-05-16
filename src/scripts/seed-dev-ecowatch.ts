import "../env.js";

import { prisma } from "../lib/prisma.js";

const ECOWATCH_MODULE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567801";

const CHECKLIST_ITEMS = [
  {
    code: "ECOWATCH-WASTE-001",
    title: "Solid waste segregation compliance",
    description: "Verify proper segregation of biodegradable, non-biodegradable, and hazardous waste",
    sortOrder: 1,
  },
  {
    code: "ECOWATCH-EFFLUENT-001",
    title: "Effluent discharge compliance",
    description: "Check that liquid effluents meet DENR standards before discharge",
    sortOrder: 2,
  },
  {
    code: "ECOWATCH-AIR-001",
    title: "Air emission controls",
    description: "Inspect stacks, vents, and dust-suppression measures",
    sortOrder: 3,
  },
  {
    code: "ECOWATCH-PERMIT-001",
    title: "Environmental compliance certificate",
    description: "Confirm valid ECC or Certificate of Non-Coverage is posted",
    sortOrder: 4,
  },
  {
    code: "ECOWATCH-RECORDS-001",
    title: "Environmental monitoring records",
    description: "Review logbooks and third-party lab results for the current quarter",
    sortOrder: 5,
  },
];

async function main() {
  await prisma.module.upsert({
    where: { id: ECOWATCH_MODULE_ID },
    update: {
      code: "ECOWATCH",
      description: "Environmental compliance inspection operations",
      isActive: true,
      name: "EcoWatch LGU",
    },
    create: {
      id: ECOWATCH_MODULE_ID,
      code: "ECOWATCH",
      description: "Environmental compliance inspection operations",
      isActive: true,
      name: "EcoWatch LGU",
    },
  });

  for (const item of CHECKLIST_ITEMS) {
    await prisma.checklistTemplate.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        description: item.description,
        module: "ECOWATCH",
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        code: item.code,
        title: item.title,
        description: item.description,
        module: "ECOWATCH",
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("EcoWatch module and checklist templates seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
