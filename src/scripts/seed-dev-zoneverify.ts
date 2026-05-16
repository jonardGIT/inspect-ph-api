import "../env.js";

import { prisma } from "../lib/prisma.js";

const ZONE_MODULE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567802";

const CHECKLIST_ITEMS = [
  {
    code: "ZONE-PERMIT-001",
    title: "Zoning clearance and locational permit",
    description:
      "Confirm valid zoning clearance is on file and matches current land use",
    sortOrder: 1,
  },
  {
    code: "ZONE-LANDUSE-001",
    title: "Land use conformity",
    description:
      "Verify actual use of the property conforms to the approved zone classification",
    sortOrder: 2,
  },
  {
    code: "ZONE-SETBACK-001",
    title: "Setback and easement compliance",
    description:
      "Measure front, side, and rear setbacks against approved site plan",
    sortOrder: 3,
  },
  {
    code: "ZONE-SIGNAGE-001",
    title: "Signage ordinance compliance",
    description:
      "Check that commercial signage dimensions and lighting comply with local ordinance",
    sortOrder: 4,
  },
  {
    code: "ZONE-ENCROACH-001",
    title: "Encroachment inspection",
    description:
      "Identify any structures encroaching on road ROW or easement zones",
    sortOrder: 5,
  },
];

async function main() {
  await prisma.module.upsert({
    where: { id: ZONE_MODULE_ID },
    update: {
      code: "ZONE",
      description: "Zoning and land use compliance inspection operations",
      isActive: true,
      name: "ZoneVerify",
    },
    create: {
      id: ZONE_MODULE_ID,
      code: "ZONE",
      description: "Zoning and land use compliance inspection operations",
      isActive: true,
      name: "ZoneVerify",
    },
  });

  for (const item of CHECKLIST_ITEMS) {
    await prisma.checklistTemplate.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        description: item.description,
        module: "ZONE",
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        code: item.code,
        title: item.title,
        description: item.description,
        module: "ZONE",
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("ZoneVerify module and checklist templates seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
