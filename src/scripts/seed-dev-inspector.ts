import "../env.js";

import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

const DEFAULT_LGU_ID = "10210b23-a6b3-49e3-b4fc-edd09df3eecd";
const DEFAULT_LGU_CODE = "TUG-DEV";
const DEFAULT_LGU_NAME = "Tuguegarao Dev LGU";
const DEFAULT_OFFICE_ID = "de4fc261-5b19-46bc-b0ec-702fa58e23bf";
const DEFAULT_OFFICE_CODE = "BPLO-HQ";
const DEFAULT_OFFICE_NAME = "BPLO Headquarters";
const DEFAULT_EMAIL = "inspector@example.com";
const DEFAULT_NAME = "Inspect PH Inspector";
const DEFAULT_PASSWORD = "password123";

async function main() {
  const email = (process.env.SEED_INSPECTOR_EMAIL || DEFAULT_EMAIL)
    .trim()
    .toLowerCase();
  const name = (process.env.SEED_INSPECTOR_NAME || DEFAULT_NAME).trim();
  const password = (
    process.env.SEED_INSPECTOR_PASSWORD || DEFAULT_PASSWORD
  ).trim();

  if (password.length < 8) {
    throw new Error(
      "SEED_INSPECTOR_PASSWORD must be at least 8 characters long",
    );
  }

  const passwordHash = await hashPassword(password);

  const lgu = await prisma.lgu.upsert({
    where: { id: DEFAULT_LGU_ID },
    update: {
      code: DEFAULT_LGU_CODE,
      name: DEFAULT_LGU_NAME,
    },
    create: {
      id: DEFAULT_LGU_ID,
      code: DEFAULT_LGU_CODE,
      name: DEFAULT_LGU_NAME,
    },
  });

  const office = await prisma.office.upsert({
    where: { id: DEFAULT_OFFICE_ID },
    update: {
      code: DEFAULT_OFFICE_CODE,
      lguId: lgu.id,
      name: DEFAULT_OFFICE_NAME,
    },
    create: {
      id: DEFAULT_OFFICE_ID,
      code: DEFAULT_OFFICE_CODE,
      lguId: lgu.id,
      name: DEFAULT_OFFICE_NAME,
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      lguId: lgu.id,
      name,
      passwordHash,
      role: "INSPECTOR",
    },
    create: {
      email,
      lguId: lgu.id,
      name,
      passwordHash,
      role: "INSPECTOR",
    },
  });

  await prisma.userOfficeAssignment.upsert({
    where: {
      userId_officeId: {
        officeId: office.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      officeId: office.id,
      userId: user.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        credentials: {
          email,
          password,
        },
        lgu: {
          code: lgu.code,
          id: lgu.id,
          name: lgu.name,
        },
        office: {
          code: office.code,
          id: office.id,
          name: office.name,
        },
        user: {
          id: user.id,
          role: user.role,
        },
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
