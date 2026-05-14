import type {
  FireSafetyCertificateStatus,
  InspectionStatus,
  Prisma,
} from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";

const FIREGUARD_MODULE_CODE = "FIRE";

export interface PublicFireSafetyCertificate {
  id: string;
  certificateNumber: string;
  createdAt: string;
  expiresAt: string;
  inspection: {
    business: {
      businessName: string;
      id: string;
    };
    completedAt?: string;
    id: string;
    office: {
      code: string;
      id: string;
      lguId: string;
      name: string;
    };
    permit: {
      id: string;
      permitNumber: string;
    };
    scheduledAt: string;
    status: Lowercase<`${InspectionStatus}`>;
  };
  issuedAt: string;
  remarks?: string;
  status: Lowercase<`${FireSafetyCertificateStatus}`>;
  updatedAt: string;
}

export interface PublicFireSafetyCertificateLookup {
  business: {
    businessName: string;
  };
  certificateNumber: string;
  expiresAt: string;
  inspection: {
    completedAt?: string;
    scheduledAt: string;
    status: Lowercase<`${InspectionStatus}`>;
  };
  issuedAt: string;
  office: {
    code: string;
    name: string;
  };
  permit: {
    permitNumber: string;
  };
  remarks?: string;
  status: Lowercase<`${FireSafetyCertificateStatus}`>;
}

export interface CreateFireSafetyCertificateInput {
  actorRole: "admin" | "inspector";
  actorUserId: string;
  certificateNumber: string;
  expiresAt: string;
  inspectionId: string;
  issuedAt: string;
  remarks?: string;
  status?: FireSafetyCertificateStatus;
}

export interface ListFireSafetyCertificatesInput {
  actorRole: "admin" | "inspector";
  actorUserId: string;
  jurisdictionScope: JurisdictionScope;
  limit: number;
  officeId?: string;
  page: number;
  skip: number;
  status?: FireSafetyCertificateStatus;
}

type CertificateWithRelations = Prisma.FireSafetyCertificateGetPayload<{
  include: {
    inspection: {
      select: {
        business: {
          select: {
            businessName: true;
            id: true;
          };
        };
        completedAt: true;
        id: true;
        office: {
          select: {
            code: true;
            id: true;
            lguId: true;
            name: true;
          };
        };
        permitRecord: {
          select: {
            id: true;
            permitNumber: true;
          };
        };
        scheduledAt: true;
        status: true;
      };
    };
  };
}>;

type PublicLookupCertificateWithRelations =
  Prisma.FireSafetyCertificateGetPayload<{
    include: {
      inspection: {
        select: {
          business: {
            select: {
              businessName: true;
            };
          };
          completedAt: true;
          office: {
            select: {
              code: true;
              name: true;
              moduleAssignments: {
                select: {
                  module: {
                    select: {
                      code: true;
                    };
                  };
                };
              };
            };
          };
          permitRecord: {
            select: {
              permitNumber: true;
            };
          };
          scheduledAt: true;
          status: true;
        };
      };
    };
  }>;

function buildScopedInspectionWhere(input: {
  actorRole: "admin" | "inspector";
  actorUserId: string;
  jurisdictionScope: JurisdictionScope;
  officeId?: string;
}): Prisma.InspectionWhereInput {
  const clauses: Prisma.InspectionWhereInput[] = [
    {
      office: {
        moduleAssignments: {
          some: {
            module: {
              code: FIREGUARD_MODULE_CODE,
            },
          },
        },
      },
    },
  ];

  if (input.jurisdictionScope.accessScope === "assigned") {
    clauses.push({
      officeId: {
        in: input.jurisdictionScope.officeIds,
      },
    });
  }

  if (input.actorRole === "inspector") {
    clauses.push({
      OR: [
        { inspectorId: input.actorUserId },
        {
          office: {
            userAssignments: {
              some: {
                userId: input.actorUserId,
              },
            },
          },
        },
      ],
    });
  }

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  }

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

function toPublicFireSafetyCertificate(
  record: CertificateWithRelations,
): PublicFireSafetyCertificate {
  return {
    certificateNumber: record.certificateNumber,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    id: record.id,
    inspection: {
      business: {
        businessName: record.inspection.business.businessName,
        id: record.inspection.business.id,
      },
      completedAt: record.inspection.completedAt?.toISOString(),
      id: record.inspection.id,
      office: {
        code: record.inspection.office.code,
        id: record.inspection.office.id,
        lguId: record.inspection.office.lguId,
        name: record.inspection.office.name,
      },
      permit: {
        id: record.inspection.permitRecord.id,
        permitNumber: record.inspection.permitRecord.permitNumber,
      },
      scheduledAt: record.inspection.scheduledAt.toISOString(),
      status:
        record.inspection.status.toLowerCase() as Lowercase<`${typeof record.inspection.status}`>,
    },
    issuedAt: record.issuedAt.toISOString(),
    remarks: record.remarks ?? undefined,
    status:
      record.status.toLowerCase() as Lowercase<`${FireSafetyCertificateStatus}`>,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toPublicFireSafetyCertificateLookup(
  record: PublicLookupCertificateWithRelations,
): PublicFireSafetyCertificateLookup {
  return {
    business: {
      businessName: record.inspection.business.businessName,
    },
    certificateNumber: record.certificateNumber,
    expiresAt: record.expiresAt.toISOString(),
    inspection: {
      completedAt: record.inspection.completedAt?.toISOString(),
      scheduledAt: record.inspection.scheduledAt.toISOString(),
      status:
        record.inspection.status.toLowerCase() as Lowercase<`${typeof record.inspection.status}`>,
    },
    issuedAt: record.issuedAt.toISOString(),
    office: {
      code: record.inspection.office.code,
      name: record.inspection.office.name,
    },
    permit: {
      permitNumber: record.inspection.permitRecord.permitNumber,
    },
    remarks: record.remarks ?? undefined,
    status:
      record.status.toLowerCase() as Lowercase<`${FireSafetyCertificateStatus}`>,
  };
}

async function ensureFireGuardInspection(inspectionId: string) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      office: {
        select: {
          moduleAssignments: {
            select: {
              module: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!inspection) {
    throw new AppError(404, "INSPECTION_NOT_FOUND", "Inspection not found");
  }

  const isFireGuardInspection = inspection.office.moduleAssignments.some(
    (assignment) => assignment.module.code === FIREGUARD_MODULE_CODE,
  );

  if (!isFireGuardInspection) {
    throw new AppError(
      400,
      "FIRE_SAFETY_CERTIFICATE_UNSUPPORTED_OFFICE",
      "Fire safety certificates are only available for FireGuard offices",
    );
  }
}

export async function listFireSafetyCertificates(
  input: ListFireSafetyCertificatesInput,
): Promise<{
  data: PublicFireSafetyCertificate[];
  meta: { limit: number; page: number; total: number };
}> {
  const where: Prisma.FireSafetyCertificateWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    inspection: buildScopedInspectionWhere({
      actorRole: input.actorRole,
      actorUserId: input.actorUserId,
      jurisdictionScope: input.jurisdictionScope,
      officeId: input.officeId,
    }),
  };

  const [total, records] = await Promise.all([
    prisma.fireSafetyCertificate.count({ where }),
    prisma.fireSafetyCertificate.findMany({
      include: {
        inspection: {
          select: {
            business: {
              select: {
                businessName: true,
                id: true,
              },
            },
            completedAt: true,
            id: true,
            office: {
              select: {
                code: true,
                id: true,
                lguId: true,
                name: true,
              },
            },
            permitRecord: {
              select: {
                id: true,
                permitNumber: true,
              },
            },
            scheduledAt: true,
            status: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: records.map(toPublicFireSafetyCertificate),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function getFireSafetyCertificateByInspection(input: {
  actorRole: "admin" | "inspector";
  actorUserId: string;
  inspectionId: string;
  jurisdictionScope: JurisdictionScope;
}): Promise<PublicFireSafetyCertificate> {
  const record = await prisma.fireSafetyCertificate.findFirst({
    include: {
      inspection: {
        select: {
          business: {
            select: {
              businessName: true,
              id: true,
            },
          },
          completedAt: true,
          id: true,
          office: {
            select: {
              code: true,
              id: true,
              lguId: true,
              name: true,
            },
          },
          permitRecord: {
            select: {
              id: true,
              permitNumber: true,
            },
          },
          scheduledAt: true,
          status: true,
        },
      },
    },
    where: {
      inspectionId: input.inspectionId,
      inspection: buildScopedInspectionWhere({
        actorRole: input.actorRole,
        actorUserId: input.actorUserId,
        jurisdictionScope: input.jurisdictionScope,
      }),
    },
  });

  if (!record) {
    throw new AppError(
      404,
      "FIRE_SAFETY_CERTIFICATE_NOT_FOUND",
      "Fire safety certificate not found",
    );
  }

  return toPublicFireSafetyCertificate(record);
}

export async function getPublicFireSafetyCertificateByNumber(input: {
  certificateNumber: string;
}): Promise<PublicFireSafetyCertificateLookup> {
  const record = await prisma.fireSafetyCertificate.findUnique({
    where: {
      certificateNumber: input.certificateNumber,
    },
    include: {
      inspection: {
        select: {
          business: {
            select: {
              businessName: true,
            },
          },
          completedAt: true,
          office: {
            select: {
              code: true,
              name: true,
              moduleAssignments: {
                select: {
                  module: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
          permitRecord: {
            select: {
              permitNumber: true,
            },
          },
          scheduledAt: true,
          status: true,
        },
      },
    },
  });

  if (
    !record ||
    !record.inspection.office.moduleAssignments.some(
      (assignment) => assignment.module.code === FIREGUARD_MODULE_CODE,
    )
  ) {
    throw new AppError(
      404,
      "FIRE_SAFETY_CERTIFICATE_NOT_FOUND",
      "Fire safety certificate not found",
    );
  }

  return toPublicFireSafetyCertificateLookup(record);
}

export async function createFireSafetyCertificate(
  input: CreateFireSafetyCertificateInput,
): Promise<PublicFireSafetyCertificate> {
  await ensureFireGuardInspection(input.inspectionId);

  const existingCertificate = await prisma.fireSafetyCertificate.findUnique({
    where: { inspectionId: input.inspectionId },
    select: { id: true },
  });

  if (existingCertificate) {
    throw new AppError(
      409,
      "FIRE_SAFETY_CERTIFICATE_EXISTS",
      "A fire safety certificate already exists for this inspection",
    );
  }

  const record = await prisma.fireSafetyCertificate.create({
    data: {
      certificateNumber: input.certificateNumber,
      expiresAt: new Date(input.expiresAt),
      inspectionId: input.inspectionId,
      issuedAt: new Date(input.issuedAt),
      remarks: input.remarks?.trim() || null,
      status: input.status ?? "ISSUED",
    },
    include: {
      inspection: {
        select: {
          business: {
            select: {
              businessName: true,
              id: true,
            },
          },
          completedAt: true,
          id: true,
          office: {
            select: {
              code: true,
              id: true,
              lguId: true,
              name: true,
            },
          },
          permitRecord: {
            select: {
              id: true,
              permitNumber: true,
            },
          },
          scheduledAt: true,
          status: true,
        },
      },
    },
  });

  return toPublicFireSafetyCertificate(record);
}
