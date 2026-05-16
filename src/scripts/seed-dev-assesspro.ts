import "../env.js";

import { prisma } from "../lib/prisma.js";

const ASSESS_MODULE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567806";

const CHECKLIST_ITEMS = [
  {
    code: "ASSESS-DECLARATION-001",
    title: "Property declaration completeness",
    description:
      "Verify tax declaration matches actual improvements and land area",
    sortOrder: 1,
  },
  {
    code: "ASSESS-CLASSIFICATION-001",
    title: "Property classification accuracy",
    description:
      "Confirm assessed classification (residential, commercial, industrial) is correct",
    sortOrder: 2,
  },
  {
    code: "ASSESS-IMPROVEMENT-001",
    title: "Undeclared improvements inspection",
    description:
      "Identify structures or additions not yet reflected in the tax declaration",
    sortOrder: 3,
  },
  {
    code: "ASSESS-EXEMPT-001",
    title: "Exemption eligibility review",
    description:
      "Review supporting documents for claimed real property tax exemptions",
    sortOrder: 4,
  },
  {
    code: "ASSESS-MARKET-001",
    title: "Market value conformity",
    description:
      "Spot-check assessed market value against current schedule of market values",
    sortOrder: 5,
  },
];

async function main() {
  await prisma.module.upsert({
    where: { id: ASSESS_MODULE_ID },
    update: {
      code: "ASSESS",
      description:
        "Real property assessment and appraisal inspection operations",
      isActive: true,
      name: "AssessPro LGU",
    },
    create: {
      id: ASSESS_MODULE_ID,
      code: "ASSESS",
      description:
        "Real property assessment and appraisal inspection operations",
      isActive: true,
      name: "AssessPro LGU",
    },
  });

  for (const item of CHECKLIST_ITEMS) {
    await prisma.checklistTemplate.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        description: item.description,
        module: "ASSESS",
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        code: item.code,
        title: item.title,
        description: item.description,
        module: "ASSESS",
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("AssessPro LGU module and checklist templates seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
