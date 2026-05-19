import "../env.js";

import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

// Created by seed-dev-inspector
const DEV_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const DEV_OFFICE_ID = "de4fc261-5b19-46bc-b0ec-702fa58e23bf";

// Created by seed-dev-inspections
const DEV_BUSINESS_ID = "f15de43c-d0df-4324-a069-cfa5145a7a6a";

const DEFAULT_PASSWORD = "password123";

const USERS = [
  {
    email: "admin@example.com",
    name: "Dev Admin",
    role: "ADMIN" as const,
    lguId: null,
    businessId: null,
    officeId: null,
  },
  {
    email: "inspector@example.com",
    name: "Dev Inspector",
    role: "INSPECTOR" as const,
    lguId: DEV_LGU_ID,
    businessId: null,
    officeId: DEV_OFFICE_ID,
  },
  {
    email: "lgu-admin@example.com",
    name: "Dev LGU Admin",
    role: "LGU_ADMIN" as const,
    lguId: DEV_LGU_ID,
    businessId: null,
    officeId: null,
  },
  {
    email: "supervisor@example.com",
    name: "Dev Office Supervisor",
    role: "OFFICE_SUPERVISOR" as const,
    lguId: DEV_LGU_ID,
    businessId: null,
    officeId: DEV_OFFICE_ID,
  },
  {
    email: "clerk@example.com",
    name: "Dev Office Clerk",
    role: "OFFICE_CLERK" as const,
    lguId: DEV_LGU_ID,
    businessId: null,
    officeId: DEV_OFFICE_ID,
  },
  {
    email: "owner@example.com",
    name: "Dev Business Owner",
    role: "BUSINESS_OWNER" as const,
    lguId: null,
    businessId: DEV_BUSINESS_ID,
    officeId: null,
  },
  {
    email: "citizen@example.com",
    name: "Dev Citizen",
    role: "CITIZEN" as const,
    lguId: null,
    businessId: null,
    officeId: null,
  },
] as const;

async function main() {
  const lgu = await prisma.lgu.findUnique({ where: { id: DEV_LGU_ID } });
  if (!lgu) {
    throw new Error(
      "Dev LGU was not found. Run npm run seed:dev-inspector first.",
    );
  }

  const business = await prisma.businessEstablishment.findUnique({
    where: { id: DEV_BUSINESS_ID },
  });
  if (!business) {
    throw new Error(
      "Dev business was not found. Run npm run seed:dev-inspections first.",
    );
  }

  const password = DEFAULT_PASSWORD;
  const passwordHash = await hashPassword(password);

  const results: Array<{
    email: string;
    id: string;
    role: string;
  }> = [];

  for (const spec of USERS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        name: spec.name,
        passwordHash,
        role: spec.role,
        lguId: spec.lguId,
        businessId: spec.businessId,
      },
      create: {
        email: spec.email,
        name: spec.name,
        passwordHash,
        role: spec.role,
        lguId: spec.lguId,
        businessId: spec.businessId,
      },
    });

    if (spec.officeId) {
      await prisma.userOfficeAssignment.upsert({
        where: {
          userId_officeId: {
            officeId: spec.officeId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          officeId: spec.officeId,
          userId: user.id,
        },
      });
    }

    results.push({ email: user.email, id: user.id, role: user.role });
  }

  console.log(
    JSON.stringify(
      {
        password,
        users: results,
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
