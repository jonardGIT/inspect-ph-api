import "../env.js";

import { prisma } from "../lib/prisma.js";

const TOURISM_MODULE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567805";

const CHECKLIST_ITEMS = [
  {
    code: "TOURISM-ACCRED-001",
    title: "DOT accreditation posting",
    description: "Confirm valid Department of Tourism accreditation certificate is prominently displayed",
    sortOrder: 1,
  },
  {
    code: "TOURISM-SAFETY-001",
    title: "Guest safety equipment",
    description: "Inspect fire extinguishers, first-aid kits, and emergency contact postings",
    sortOrder: 2,
  },
  {
    code: "TOURISM-SANITATION-001",
    title: "Sanitation and food-handling",
    description: "Review kitchen hygiene, food storage temperatures, and health certificates of staff",
    sortOrder: 3,
  },
  {
    code: "TOURISM-ACCESSIBLE-001",
    title: "Accessibility compliance",
    description: "Check ramps, railings, and accessible restrooms per Batas Pambansa 344",
    sortOrder: 4,
  },
  {
    code: "TOURISM-RATES-001",
    title: "Rate transparency compliance",
    description: "Verify room rates are posted at the front desk and match accreditation filings",
    sortOrder: 5,
  },
];

async function main() {
  await prisma.module.upsert({
    where: { id: TOURISM_MODULE_ID },
    update: {
      code: "TOURISM",
      description: "Tourism establishment compliance inspection operations",
      isActive: true,
      name: "TourismSafe Check",
    },
    create: {
      id: TOURISM_MODULE_ID,
      code: "TOURISM",
      description: "Tourism establishment compliance inspection operations",
      isActive: true,
      name: "TourismSafe Check",
    },
  });

  for (const item of CHECKLIST_ITEMS) {
    await prisma.checklistTemplate.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        description: item.description,
        module: "TOURISM",
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        code: item.code,
        title: item.title,
        description: item.description,
        module: "TOURISM",
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("TourismSafe Check module and checklist templates seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
