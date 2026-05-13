import "../env.js";

import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

const DEFAULT_EMAIL = "admin@example.com";
const DEFAULT_NAME = "Inspect PH Admin";
const DEFAULT_PASSWORD = "password123";

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || DEFAULT_EMAIL)
    .trim()
    .toLowerCase();
  const name = (process.env.SEED_ADMIN_NAME || DEFAULT_NAME).trim();
  const password = (process.env.SEED_ADMIN_PASSWORD || DEFAULT_PASSWORD).trim();

  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters long");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(
    JSON.stringify(
      {
        credentials: {
          email,
          password,
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
