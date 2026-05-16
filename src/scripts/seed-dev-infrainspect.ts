import "../env.js";

import { prisma } from "../lib/prisma.js";

const INFRA_MODULE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567803";

const CHECKLIST_ITEMS = [
  {
    code: "INFRA-STRUCT-001",
    title: "Structural integrity assessment",
    description:
      "Visual inspection of columns, beams, and load-bearing walls for cracks or deformation",
    sortOrder: 1,
  },
  {
    code: "INFRA-ELECTRICAL-001",
    title: "Electrical systems compliance",
    description:
      "Verify wiring, panel boards, and grounding comply with the Philippine Electrical Code",
    sortOrder: 2,
  },
  {
    code: "INFRA-PLUMBING-001",
    title: "Plumbing and drainage systems",
    description:
      "Check water supply lines, drainage outlets, and trap installations",
    sortOrder: 3,
  },
  {
    code: "INFRA-PERMIT-001",
    title: "Building permit and as-built plan",
    description:
      "Confirm building permit is posted and as-built plans match actual construction",
    sortOrder: 4,
  },
  {
    code: "INFRA-SAFETY-001",
    title: "Safety features and egress",
    description:
      "Inspect emergency exits, stairwells, handrails, and fire exits for obstruction",
    sortOrder: 5,
  },
];

async function main() {
  await prisma.module.upsert({
    where: { id: INFRA_MODULE_ID },
    update: {
      code: "INFRA",
      description:
        "Infrastructure and building compliance inspection operations",
      isActive: true,
      name: "InfraInspect Pro",
    },
    create: {
      id: INFRA_MODULE_ID,
      code: "INFRA",
      description:
        "Infrastructure and building compliance inspection operations",
      isActive: true,
      name: "InfraInspect Pro",
    },
  });

  for (const item of CHECKLIST_ITEMS) {
    await prisma.checklistTemplate.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        description: item.description,
        module: "INFRA",
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        code: item.code,
        title: item.title,
        description: item.description,
        module: "INFRA",
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("InfraInspect Pro module and checklist templates seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
