import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";

export interface ProvisionOfficeInput {
  name: string;
  code: string;
  moduleIds: string[];
}

export interface ProvisionLguInput {
  // LGU details
  lguName: string;
  lguCode: string;
  region?: string;
  // Initial office
  offices: ProvisionOfficeInput[];
  // Initial lgu_admin user
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface ProvisionedLgu {
  lguId: string;
  lguName: string;
  lguCode: string;
  officeIds: string[];
  adminUserId: string;
  adminEmail: string;
}

export async function provisionLgu(
  input: ProvisionLguInput,
  actorId: string,
): Promise<ProvisionedLgu> {
  // Validate module IDs exist before entering the transaction
  if (input.offices.some((o) => o.moduleIds.length > 0)) {
    const allModuleIds = [
      ...new Set(input.offices.flatMap((o) => o.moduleIds)),
    ];
    const foundModules = await prisma.module.findMany({
      where: { id: { in: allModuleIds } },
      select: { id: true },
    });
    const foundIds = new Set(foundModules.map((m) => m.id));
    const missing = allModuleIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new Error(`Module IDs not found: ${missing.join(", ")}`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the LGU
    const lgu = await tx.lgu.create({
      data: {
        code: input.lguCode.trim().toUpperCase(),
        name: input.lguName.trim(),
        ...(input.region ? { region: input.region.trim() } : {}),
      },
    });

    // 2. Create initial office(s) with module assignments
    const createdOffices: Array<{ id: string; code: string; name: string }> =
      [];

    for (const officeInput of input.offices) {
      const office = await tx.office.create({
        data: {
          code: officeInput.code.trim().toUpperCase(),
          lguId: lgu.id,
          name: officeInput.name.trim(),
        },
      });
      createdOffices.push(office);

      // Enable each requested module on this office
      for (const moduleId of officeInput.moduleIds) {
        await tx.officeModule.create({
          data: { moduleId, officeId: office.id },
        });
      }
    }

    // 3. Create initial lgu_admin user linked to this LGU
    const admin = await tx.user.create({
      data: {
        email: input.adminEmail.trim().toLowerCase(),
        lguId: lgu.id,
        name: input.adminName.trim(),
        passwordHash: await hashPassword(input.adminPassword),
        role: "LGU_ADMIN",
      },
    });

    // 4. Assign admin to all created offices
    for (const office of createdOffices) {
      await tx.userOfficeAssignment.create({
        data: { officeId: office.id, userId: admin.id },
      });
    }

    return { admin, createdOffices, lgu };
  });

  await recordAuditLog({
    action: "lgu.provisioned",
    actorUserId: actorId,
    actorRole: "admin",
    entityId: result.lgu.id,
    entityType: "lgu",
    summary: `Provisioned LGU "${result.lgu.name}" (${result.lgu.code}) with ${result.createdOffices.length} office(s)`,
    detail: result.admin.email,
  });

  return {
    adminEmail: result.admin.email,
    adminUserId: result.admin.id,
    lguCode: result.lgu.code,
    lguId: result.lgu.id,
    lguName: result.lgu.name,
    officeIds: result.createdOffices.map((o) => o.id),
  };
}
