import type { AuthRole } from "../lib/auth-provider.js";
import type {
  Attachment,
  ChecklistResultStatus,
  ChecklistTemplate,
  Finding,
  FindingSeverity,
  Inspection,
  Prisma,
  UserRole,
} from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { inspectionEventBus } from "../lib/inspection-event-bus.js";
import { prisma } from "../lib/prisma.js";
import { getAttachmentStorageProvider } from "../lib/storage-provider.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";
import { recordAuditLog } from "./audit-logs.js";
import { enqueueNotificationOutbox } from "./notifications-outbox.js";
import { enqueueWebhookEvent } from "./webhook-delivery.js";

export interface ListInspectionsInput {
  actorRole: AuthRole;
  actorUserId: string;
  businessId?: string;
  inspectorId?: string;
  jurisdictionScope: JurisdictionScope;
  limit: number;
  lguId?: string;
  moduleCode?: string;
  officeId?: string;
  page: number;
  permitRecordId?: string;
  skip: number;
  status?: Inspection["status"];
}

export interface CreateInspectionInput {
  actorRole: AuthRole;
  actorUserId: string;
  businessId: string;
  accuracyMeters?: number;
  inspectorId?: string;
  latitude?: number;
  longitude?: number;
  moduleCode?: string;
  notes?: string;
  officeId: string;
  permitRecordId: string;
  scheduledAt: string;
}

export interface AssignInspectionInput {
  actorRole: AuthRole;
  actorUserId: string;
  id: string;
  inspectorId: string;
}

export interface UpdateInspectionStatusInput {
  accuracyMeters?: number;
  actorRole: AuthRole;
  actorUserId: string;
  id: string;
  jurisdictionScope?: JurisdictionScope;
  latitude?: number;
  longitude?: number;
  notes?: string;
  status: Inspection["status"];
}

export interface PublicInspection {
  business: {
    businessName: string;
    id: string;
  };
  completedAt?: string;
  createdAt: string;
  id: string;
  inspectorId?: string;
  moduleCode?: string;
  location?: {
    accuracyMeters?: number;
    latitude: number;
    longitude: number;
  };
  notes?: string;
  office: {
    code: string;
    id: string;
    lguId: string;
    moduleCodes: string[];
    name: string;
  };
  permit: {
    id: string;
    permitNumber: string;
  };
  scheduledAt: string;
  startedAt?: string;
  status: Lowercase<`${Inspection["status"]}`>;
  updatedAt: string;
}

export interface PublicChecklistTemplate {
  code: string;
  createdAt: string;
  description?: string;
  id: string;
  isActive: boolean;
  module: string;
  sortOrder: number;
  title: string;
  updatedAt: string;
}

export interface PublicChecklistResult {
  createdAt: string;
  id: string;
  inspectionId: string;
  remarks?: string;
  status: Lowercase<`${ChecklistResultStatus}`>;
  template: {
    code: string;
    id: string;
    module: string;
    title: string;
  };
  updatedAt: string;
}

export interface PublicFinding {
  checklistResultId?: string;
  correctiveAction?: string;
  createdAt: string;
  description: string;
  dueDate?: string;
  id: string;
  inspectionId: string;
  location?: {
    accuracyMeters?: number;
    latitude: number;
    longitude: number;
  };
  resolvedAt?: string;
  severity: Lowercase<`${FindingSeverity}`>;
  title: string;
  updatedAt: string;
}

export interface PublicInspectionSummary {
  canceled: number;
  completed: number;
  inProgress: number;
  overdue: number;
  scheduled: number;
  total: number;
}

export interface PublicInspectionMapPoint {
  business: {
    businessName: string;
    id: string;
  };
  id: string;
  location: {
    accuracyMeters?: number;
    latitude: number;
    longitude: number;
  };
  office: {
    code: string;
    id: string;
    lguId: string;
    name: string;
  };
  scheduledAt: string;
  status: Lowercase<`${Inspection["status"]}`>;
}

export interface PublicAttachment {
  capturedAt?: string;
  createdAt: string;
  fileName: string;
  fileSizeBytes: number;
  findingId?: string;
  id: string;
  inspectionId: string;
  location?: {
    accuracyMeters?: number;
    latitude: number;
    longitude: number;
  };
  mimeType: string;
  storageKey: string;
  updatedAt: string;
}

export interface PublicAttachmentUploadIntent {
  expiresInSeconds?: number;
  provider: "local" | "supabase";
  requiresMetadataCreate: boolean;
  storageKey: string;
  uploadHeaders: Record<string, string>;
  uploadMethod: "PUT";
  uploadPath?: string;
  uploadStrategy: "api_binary_upload" | "supabase_signed_url";
  uploadToken?: string;
  uploadUrl?: string;
}

export interface PublicAttachmentDownloadIntent {
  downloadMethod: "GET";
  downloadPath?: string;
  downloadStrategy: "api_binary_download" | "supabase_signed_url";
  downloadUrl?: string;
  expiresInSeconds?: number;
  provider: "local" | "supabase";
}

export interface PublicInspectionHistoryEvent {
  detail?: string;
  entityId?: string;
  occurredAt: string;
  title: string;
  type:
    | "inspection_created"
    | "inspection_started"
    | "inspection_completed"
    | "checklist_result_recorded"
    | "finding_logged"
    | "finding_resolved"
    | "attachment_uploaded";
}

const INSPECTION_INCLUDE = {
  business: { select: { businessName: true, id: true } },
  office: {
    select: {
      code: true,
      id: true,
      lguId: true,
      moduleAssignments: {
        select: { module: { select: { code: true } } },
      },
      name: true,
    },
  },
  permitRecord: { select: { id: true, permitNumber: true } },
} as const;

type InspectionWithRelations = Prisma.InspectionGetPayload<{
  include: typeof INSPECTION_INCLUDE;
}>;

type ChecklistTemplateRecord = ChecklistTemplate;

type ChecklistResultWithTemplate = Prisma.InspectionChecklistResultGetPayload<{
  include: {
    template: {
      select: {
        code: true;
        id: true;
        module: true;
        title: true;
      };
    };
  };
}>;

type FindingRecordWithRelations = Finding;

type AttachmentRecord = Attachment;

const ALLOWED_STATUS_TRANSITIONS: Record<
  Inspection["status"],
  Inspection["status"][]
> = {
  CANCELED: [],
  COMPLETED: [],
  IN_PROGRESS: ["COMPLETED", "CANCELED", "OVERDUE"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED", "CANCELED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELED", "OVERDUE"],
};

function toPublicInspection(record: InspectionWithRelations): PublicInspection {
  return {
    business: {
      businessName: record.business.businessName,
      id: record.business.id,
    },
    completedAt: record.completedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    inspectorId: record.inspectorId ?? undefined,
    moduleCode: record.moduleCode ?? undefined,
    location:
      record.locationLatitude != null && record.locationLongitude != null
        ? {
            accuracyMeters: record.locationAccuracyMeters ?? undefined,
            latitude: record.locationLatitude,
            longitude: record.locationLongitude,
          }
        : undefined,
    notes: record.notes ?? undefined,
    office: {
      code: record.office.code,
      id: record.office.id,
      lguId: record.office.lguId,
      moduleCodes: record.office.moduleAssignments.map((a) => a.module.code),
      name: record.office.name,
    },
    permit: {
      id: record.permitRecord.id,
      permitNumber: record.permitRecord.permitNumber,
    },
    scheduledAt: record.scheduledAt.toISOString(),
    startedAt: record.startedAt?.toISOString(),
    status: record.status.toLowerCase() as Lowercase<`${Inspection["status"]}`>,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toPublicChecklistTemplate(
  record: ChecklistTemplateRecord,
): PublicChecklistTemplate {
  return {
    code: record.code,
    createdAt: record.createdAt.toISOString(),
    description: record.description ?? undefined,
    id: record.id,
    isActive: record.isActive,
    module: record.module,
    sortOrder: record.sortOrder,
    title: record.title,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toPublicChecklistResult(
  record: ChecklistResultWithTemplate,
): PublicChecklistResult {
  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    inspectionId: record.inspectionId,
    remarks: record.remarks ?? undefined,
    status:
      record.status.toLowerCase() as Lowercase<`${ChecklistResultStatus}`>,
    template: {
      code: record.template.code,
      id: record.template.id,
      module: record.template.module,
      title: record.template.title,
    },
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toPublicFinding(
  record: FindingRecordWithRelations,
): PublicFinding {
  return {
    checklistResultId: record.checklistResultId ?? undefined,
    correctiveAction: record.correctiveAction ?? undefined,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    dueDate: record.dueDate?.toISOString(),
    id: record.id,
    inspectionId: record.inspectionId,
    location:
      record.locationLatitude != null && record.locationLongitude != null
        ? {
            accuracyMeters: record.locationAccuracyMeters ?? undefined,
            latitude: record.locationLatitude,
            longitude: record.locationLongitude,
          }
        : undefined,
    resolvedAt: record.resolvedAt?.toISOString(),
    severity: record.severity.toLowerCase() as Lowercase<`${FindingSeverity}`>,
    title: record.title,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toPublicAttachment(record: AttachmentRecord): PublicAttachment {
  return {
    capturedAt: record.capturedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    fileName: record.fileName,
    fileSizeBytes: record.fileSizeBytes,
    findingId: record.findingId ?? undefined,
    id: record.id,
    inspectionId: record.inspectionId,
    location:
      record.locationLatitude != null && record.locationLongitude != null
        ? {
            accuracyMeters: record.locationAccuracyMeters ?? undefined,
            latitude: record.locationLatitude,
            longitude: record.locationLongitude,
          }
        : undefined,
    mimeType: record.mimeType,
    storageKey: record.storageKey,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildLocationData(input: {
  accuracyMeters?: number;
  latitude?: number;
  longitude?: number;
}) {
  if (input.latitude == null || input.longitude == null) {
    return {};
  }

  return {
    locationAccuracyMeters: input.accuracyMeters ?? null,
    locationLatitude: input.latitude,
    locationLongitude: input.longitude,
  };
}

function buildScopedInspectionClauses(input: {
  actorRole: AuthRole;
  actorUserId: string;
  jurisdictionScope: JurisdictionScope;
  lguId?: string;
  /** Pre-fetched module codes for the inspector. When provided and non-empty,
   *  adds a module code filter to prevent cross-module list leakage.
   *  Mirrors the same guard in getScopedInspection. */
  inspectorModuleCodes?: string[];
}) {
  const clauses: Prisma.InspectionWhereInput[] = [];

  if (input.actorRole === "inspector") {
    clauses.push({ inspectorId: input.actorUserId });
    if (input.inspectorModuleCodes && input.inspectorModuleCodes.length > 0) {
      clauses.push({
        OR: [
          { moduleCode: null },
          { moduleCode: { in: input.inspectorModuleCodes } },
        ],
      });
    }
  }

  const { accessScope, officeIds, lguIds } = input.jurisdictionScope;
  if (accessScope === "office" || accessScope === "assigned") {
    clauses.push({
      officeId: {
        in: officeIds,
      },
    });
  } else if (accessScope === "lgu") {
    clauses.push({
      office: {
        lguId: {
          in: lguIds,
        },
      },
    });
  }

  if (input.lguId) {
    clauses.push({
      office: {
        lguId: input.lguId,
      },
    });
  }

  return clauses;
}

function buildScheduledWindowClause(input: { from?: string; to?: string }) {
  if (!input.from && !input.to) {
    return null;
  }

  return {
    scheduledAt: {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    },
  } satisfies Prisma.InspectionWhereInput;
}

function buildInspectionWhere(
  input: ListInspectionsInput,
  inspectorModuleCodes?: string[],
): Prisma.InspectionWhereInput {
  const clauses = buildScopedInspectionClauses({
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    jurisdictionScope: input.jurisdictionScope,
    lguId: input.lguId,
    inspectorModuleCodes,
  });

  if (input.businessId) {
    clauses.push({ businessId: input.businessId });
  }

  if (input.permitRecordId) {
    clauses.push({ permitRecordId: input.permitRecordId });
  }

  if (input.inspectorId && input.actorRole === "admin") {
    clauses.push({ inspectorId: input.inspectorId });
  }

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  }

  if (input.status) {
    clauses.push({ status: input.status });
  }

  if (input.moduleCode) {
    clauses.push({ moduleCode: input.moduleCode.trim().toUpperCase() });
  }

  return clauses.length === 0 ? {} : { AND: clauses };
}

function toPublicInspectionMapPoint(
  record: Prisma.InspectionGetPayload<{
    select: {
      business: {
        select: {
          businessName: true;
          id: true;
        };
      };
      id: true;
      locationAccuracyMeters: true;
      locationLatitude: true;
      locationLongitude: true;
      office: {
        select: {
          code: true;
          id: true;
          lguId: true;
          name: true;
        };
      };
      scheduledAt: true;
      status: true;
    };
  }>,
): PublicInspectionMapPoint {
  return {
    business: {
      businessName: record.business.businessName,
      id: record.business.id,
    },
    id: record.id,
    location: {
      ...(record.locationAccuracyMeters != null
        ? { accuracyMeters: record.locationAccuracyMeters }
        : {}),
      latitude: record.locationLatitude!,
      longitude: record.locationLongitude!,
    },
    office: {
      code: record.office.code,
      id: record.office.id,
      lguId: record.office.lguId,
      name: record.office.name,
    },
    scheduledAt: record.scheduledAt.toISOString(),
    status: record.status.toLowerCase() as Lowercase<`${Inspection["status"]}`>,
  };
}

async function ensurePermitMatchesBusiness(
  businessId: string,
  permitRecordId: string,
): Promise<void> {
  const permit = await prisma.permitRecord.findUnique({
    where: { id: permitRecordId },
    select: {
      businessId: true,
      id: true,
    },
  });

  if (!permit) {
    throw new AppError(404, "PERMIT_NOT_FOUND", "Permit record not found");
  }

  if (permit.businessId !== businessId) {
    throw new AppError(
      400,
      "PERMIT_BUSINESS_MISMATCH",
      "Permit record does not belong to the selected business",
    );
  }
}

async function ensureOfficeExists(officeId: string): Promise<void> {
  const office = await prisma.office.findUnique({
    where: { id: officeId },
    select: { id: true },
  });

  if (!office) {
    throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found");
  }
}

async function ensureInspectionAssignee(inspectorId: string): Promise<void> {
  const inspector = await prisma.user.findFirst({
    where: {
      id: inspectorId,
      role: "INSPECTOR" satisfies UserRole,
    },
    select: { id: true },
  });

  if (!inspector) {
    throw new AppError(404, "INSPECTOR_NOT_FOUND", "Inspector not found");
  }
}

async function ensureInspectorCanOperateOffice(
  inspectorId: string,
  officeId: string,
): Promise<void> {
  const assignment = await prisma.userOfficeAssignment.findFirst({
    where: {
      officeId,
      userId: inspectorId,
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new AppError(
      400,
      "INSPECTOR_OFFICE_SCOPE_MISMATCH",
      "Inspector is not assigned to the selected office",
    );
  }
}

/**
 * Returns the distinct module codes accessible to an inspector across all
 * their office assignments. Used to gate both read and write operations.
 */
async function getInspectorModuleCodes(userId: string): Promise<string[]> {
  const assignments = await prisma.userOfficeAssignment.findMany({
    where: { userId },
    select: {
      office: {
        select: {
          moduleAssignments: {
            select: { module: { select: { code: true } } },
          },
        },
      },
    },
  });

  return [
    ...new Set(
      assignments.flatMap((a) =>
        a.office.moduleAssignments.map((m) => m.module.code),
      ),
    ),
  ];
}

/**
 * Throws 403 when the inspector's office does not handle `moduleCode`.
 * Should be called after `ensureInspectorCanOperateOffice` whenever an
 * inspection carries a non-null moduleCode.
 */
async function ensureInspectorModuleAccess(
  inspectorId: string,
  moduleCode: string,
  officeId: string,
): Promise<void> {
  const assignment = await prisma.userOfficeAssignment.findFirst({
    where: {
      userId: inspectorId,
      officeId,
      office: {
        moduleAssignments: {
          some: { module: { code: moduleCode } },
        },
      },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new AppError(
      403,
      "INSPECTOR_MODULE_SCOPE_MISMATCH",
      "Inspector is not authorized for this inspection's module",
    );
  }
}

async function listAdminNotificationRecipientIds(excludeUserId?: string) {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN" satisfies UserRole,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return admins.map((admin) => admin.id);
}

async function getScopedInspection(
  id: string,
  actorRole: AuthRole,
  actorUserId: string,
  jurisdictionScope?: JurisdictionScope,
): Promise<InspectionWithRelations | null> {
  let scopeClauses: Prisma.InspectionWhereInput = {};

  if (actorRole === "inspector") {
    const moduleCodes = await getInspectorModuleCodes(actorUserId);
    scopeClauses = {
      inspectorId: actorUserId,
      office: { userAssignments: { some: { userId: actorUserId } } },
      // If the inspector has module assignments, only show inspections for
      // those modules. Inspections without a moduleCode (legacy) are always
      // visible to avoid breaking older records.
      ...(moduleCodes.length > 0
        ? {
            OR: [
              { moduleCode: null },
              { moduleCode: { in: moduleCodes } },
            ],
          }
        : {}),
    };
  } else if (jurisdictionScope) {
    const { accessScope, officeIds, lguIds } = jurisdictionScope;
    if (accessScope === "office" || accessScope === "assigned") {
      scopeClauses = { officeId: { in: officeIds } };
    } else if (accessScope === "lgu") {
      scopeClauses = { office: { lguId: { in: lguIds } } };
    }
    // accessScope === "global": no additional WHERE restriction
  }

  return prisma.inspection.findFirst({
    where: { id, ...scopeClauses },
    include: INSPECTION_INCLUDE,
  });
}

async function ensureAccessibleInspection(
  id: string,
  actorRole: AuthRole,
  actorUserId: string,
  jurisdictionScope?: JurisdictionScope,
): Promise<InspectionWithRelations> {
  const inspection = await getScopedInspection(
    id,
    actorRole,
    actorUserId,
    jurisdictionScope,
  );

  if (!inspection) {
    throw new AppError(404, "INSPECTION_NOT_FOUND", "Inspection not found");
  }

  return inspection;
}

async function ensureChecklistTemplate(templateId: string): Promise<{
  id: string;
  code: string;
  title: string;
  description: string | null;
  module: string;
  sortOrder: number;
  version: number;
}> {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      isActive: true,
      code: true,
      title: true,
      description: true,
      module: true,
      sortOrder: true,
      version: true,
    },
  });

  if (!template || !template.isActive) {
    throw new AppError(
      404,
      "CHECKLIST_TEMPLATE_NOT_FOUND",
      "Checklist template not found",
    );
  }

  return template;
}

async function ensureChecklistResultBelongsToInspection(
  inspectionId: string,
  checklistResultId: string,
): Promise<void> {
  const result = await prisma.inspectionChecklistResult.findUnique({
    where: { id: checklistResultId },
    select: { id: true, inspectionId: true },
  });

  if (!result) {
    throw new AppError(
      404,
      "CHECKLIST_RESULT_NOT_FOUND",
      "Checklist result not found",
    );
  }

  if (result.inspectionId !== inspectionId) {
    throw new AppError(
      400,
      "CHECKLIST_RESULT_INSPECTION_MISMATCH",
      "Checklist result does not belong to the selected inspection",
    );
  }
}

async function ensureFindingBelongsToInspection(
  inspectionId: string,
  findingId: string,
): Promise<void> {
  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    select: { id: true, inspectionId: true },
  });

  if (!finding) {
    throw new AppError(404, "FINDING_NOT_FOUND", "Finding not found");
  }

  if (finding.inspectionId !== inspectionId) {
    throw new AppError(
      400,
      "FINDING_INSPECTION_MISMATCH",
      "Finding does not belong to the selected inspection",
    );
  }
}

function assertStatusTransition(
  currentStatus: Inspection["status"],
  nextStatus: Inspection["status"],
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new AppError(
      400,
      "INVALID_INSPECTION_STATUS_TRANSITION",
      `Cannot transition inspection from ${currentStatus} to ${nextStatus}`,
    );
  }
}

export async function listInspections(input: ListInspectionsInput): Promise<{
  data: PublicInspection[];
  meta: { limit: number; page: number; total: number };
}> {
  const inspectorModuleCodes =
    input.actorRole === "inspector"
      ? await getInspectorModuleCodes(input.actorUserId)
      : undefined;
  const where = buildInspectionWhere(input, inspectorModuleCodes);
  const [total, inspections] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.findMany({
      include: INSPECTION_INCLUDE,
      orderBy: { scheduledAt: "asc" },
      skip: input.skip,
      take: input.limit,
      where,
    }),
  ]);

  return {
    data: inspections.map(toPublicInspection),
    meta: {
      limit: input.limit,
      page: input.page,
      total,
    },
  };
}

export async function getInspectionById(input: {
  id: string;
  actorRole: AuthRole;
  actorUserId: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<PublicInspection> {
  const inspection = await ensureAccessibleInspection(
    input.id,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  return toPublicInspection(inspection);
}

export async function createInspection(
  input: CreateInspectionInput,
): Promise<PublicInspection> {
  const business = await prisma.businessEstablishment.findUnique({
    where: { id: input.businessId },
    select: { id: true },
  });

  if (!business) {
    throw new AppError(
      404,
      "BUSINESS_NOT_FOUND",
      "Business establishment not found",
    );
  }

  await ensurePermitMatchesBusiness(input.businessId, input.permitRecordId);
  await ensureOfficeExists(input.officeId);

  if (input.inspectorId) {
    await ensureInspectionAssignee(input.inspectorId);
    await ensureInspectorCanOperateOffice(input.inspectorId, input.officeId);
    if (input.moduleCode) {
      await ensureInspectorModuleAccess(
        input.inspectorId,
        input.moduleCode.trim().toUpperCase(),
        input.officeId,
      );
    }
  }

  const inspection = await prisma.inspection.create({
    data: {
      businessId: input.businessId,
      inspectorId: input.inspectorId ?? null,
      moduleCode: input.moduleCode?.trim().toUpperCase() || null,
      officeId: input.officeId,
      ...buildLocationData(input),
      notes: input.notes?.trim() || null,
      permitRecordId: input.permitRecordId,
      scheduledAt: new Date(input.scheduledAt),
    },
    include: INSPECTION_INCLUDE,
  });

  await recordAuditLog({
    action: "inspection.created",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    detail: inspection.inspectorId
      ? `Assigned to inspector ${inspection.inspectorId}`
      : undefined,
    entityId: inspection.id,
    entityType: "inspection",
    summary: `Scheduled inspection for ${inspection.business.businessName}`,
  });

  if (inspection.inspectorId) {
    await enqueueNotificationOutbox({
      body: `${inspection.business.businessName} is scheduled for ${inspection.scheduledAt.toISOString()}.`,
      entityId: inspection.id,
      entityType: "inspection",
      eventType: "inspection.assigned",
      recipientUserId: inspection.inspectorId,
      title: `Inspection assigned: ${inspection.business.businessName}`,
    });
  }

  return toPublicInspection(inspection);
}

export async function assignInspection(
  input: AssignInspectionInput,
): Promise<PublicInspection> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: input.id },
    select: { id: true, officeId: true, moduleCode: true },
  });

  if (!inspection) {
    throw new AppError(404, "INSPECTION_NOT_FOUND", "Inspection not found");
  }

  await ensureInspectionAssignee(input.inspectorId);
  await ensureInspectorCanOperateOffice(input.inspectorId, inspection.officeId);
  if (inspection.moduleCode) {
    await ensureInspectorModuleAccess(
      input.inspectorId,
      inspection.moduleCode,
      inspection.officeId,
    );
  }

  const updatedInspection = await prisma.inspection.update({
    where: { id: input.id },
    data: {
      inspectorId: input.inspectorId,
    },
    include: INSPECTION_INCLUDE,
  });

  await recordAuditLog({
    action: "inspection.assigned",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    detail: `Assigned inspector ${input.inspectorId}`,
    entityId: updatedInspection.id,
    entityType: "inspection",
    summary: `Assigned inspection for ${updatedInspection.business.businessName}`,
  });

  await enqueueNotificationOutbox({
    body: `${updatedInspection.business.businessName} is scheduled for ${updatedInspection.scheduledAt.toISOString()}.`,
    entityId: updatedInspection.id,
    entityType: "inspection",
    eventType: "inspection.assigned",
    recipientUserId: input.inspectorId,
    title: `Inspection assigned: ${updatedInspection.business.businessName}`,
  });

  inspectionEventBus.publish({
    entityId: updatedInspection.id,
    entityType: "inspection",
    eventType: "inspection.assigned",
    lguId: updatedInspection.office.lguId ?? undefined,
    officeId: updatedInspection.office.id,
    payload: {
      businessName: updatedInspection.business.businessName,
      inspectorId: input.inspectorId,
      status: updatedInspection.status.toLowerCase(),
    },
  });

  return toPublicInspection(updatedInspection);
}

export async function updateInspectionStatus(
  input: UpdateInspectionStatusInput,
): Promise<PublicInspection> {
  const inspection = await getScopedInspection(
    input.id,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  if (!inspection) {
    throw new AppError(404, "INSPECTION_NOT_FOUND", "Inspection not found");
  }

  assertStatusTransition(inspection.status, input.status);

  const now = new Date();
  const updatedInspection = await prisma.inspection.update({
    where: { id: input.id },
    data: {
      completedAt: input.status === "COMPLETED" ? now : null,
      ...buildLocationData(input),
      notes: input.notes?.trim() || inspection.notes,
      startedAt:
        input.status === "IN_PROGRESS" || input.status === "COMPLETED"
          ? (inspection.startedAt ?? now)
          : inspection.startedAt,
      status: input.status,
    },
    include: INSPECTION_INCLUDE,
  });

  await recordAuditLog({
    action: "inspection.status_updated",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    detail: `Inspection status changed to ${updatedInspection.status.toLowerCase()}`,
    entityId: updatedInspection.id,
    entityType: "inspection",
    summary: `Updated inspection status for ${updatedInspection.business.businessName}`,
  });

  const adminRecipientIds = await listAdminNotificationRecipientIds(
    input.actorRole === "admin" ? input.actorUserId : undefined,
  );

  if (adminRecipientIds.length > 0) {
    const normalizedStatus = updatedInspection.status
      .toLowerCase()
      .split("_")
      .join(" ");

    await enqueueNotificationOutbox(
      adminRecipientIds.map((recipientUserId) => ({
        body: `${updatedInspection.business.businessName} is now ${normalizedStatus}.`,
        entityId: updatedInspection.id,
        entityType: "inspection",
        eventType: "inspection.status_updated",
        recipientUserId,
        title: `Inspection status updated: ${updatedInspection.business.businessName}`,
      })),
    );
  }

  inspectionEventBus.publish({
    entityId: updatedInspection.id,
    entityType: "inspection",
    eventType: "inspection.status_updated",
    lguId: updatedInspection.office.lguId ?? undefined,
    officeId: updatedInspection.office.id,
    payload: {
      businessName: updatedInspection.business.businessName,
      status: updatedInspection.status.toLowerCase(),
    },
  });

  if (input.status === "COMPLETED" && updatedInspection.office.lguId) {
    void enqueueWebhookEvent(
      updatedInspection.office.lguId,
      "inspection.completed",
      {
        inspectionId: updatedInspection.id,
        businessId: updatedInspection.businessId,
        businessName: updatedInspection.business.businessName,
        permitId: updatedInspection.permitRecord.id,
        permitNumber: updatedInspection.permitRecord.permitNumber,
        officeId: updatedInspection.office.id,
        completedAt: updatedInspection.completedAt?.toISOString(),
      },
    );
  }

  return toPublicInspection(updatedInspection);
}

export async function listChecklistTemplates(input: {
  actorRole: AuthRole;
  actorUserId: string;
  jurisdictionScope?: JurisdictionScope;
  module?: string;
}): Promise<PublicChecklistTemplate[]> {
  let moduleCodes: string[] | undefined;

  if (input.actorRole === "inspector") {
    const assignments = await prisma.userOfficeAssignment.findMany({
      where: { userId: input.actorUserId },
      select: {
        office: {
          select: {
            moduleAssignments: {
              select: { module: { select: { code: true, isActive: true } } },
            },
          },
        },
      },
    });

    const inspectorModuleCodes = [
      ...new Set(
        assignments.flatMap((a) =>
          a.office.moduleAssignments
            .filter((m) => m.module.isActive)
            .map((m) => m.module.code),
        ),
      ),
    ];

    if (input.module) {
      const upper = input.module.trim().toUpperCase();
      if (
        inspectorModuleCodes.length > 0 &&
        !inspectorModuleCodes.includes(upper)
      ) {
        throw new AppError(
          403,
          "MODULE_ACCESS_DENIED",
          "You are not assigned to the requested module",
        );
      }
      moduleCodes = [upper];
    } else {
      moduleCodes =
        inspectorModuleCodes.length > 0 ? inspectorModuleCodes : undefined;
    }
  } else if (input.module) {
    moduleCodes = [input.module.trim().toUpperCase()];
  }

  // Build LGU scope clause: office/lgu-scoped roles see their LGU's templates
  // plus globally shared templates (lguId IS NULL).
  let lguScopeClause: Prisma.ChecklistTemplateWhereInput = {};
  if (input.jurisdictionScope) {
    const { accessScope, lguIds } = input.jurisdictionScope;
    if (
      (accessScope === "office" || accessScope === "lgu") &&
      lguIds.length > 0
    ) {
      lguScopeClause = {
        OR: [{ lguId: { in: lguIds } }, { lguId: null }],
      };
    }
  }

  const templates = await prisma.checklistTemplate.findMany({
    where: {
      ...(moduleCodes && moduleCodes.length > 0
        ? { module: { in: moduleCodes } }
        : {}),
      ...lguScopeClause,
      isActive: true,
    },
    orderBy: [{ module: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });

  return templates.map(toPublicChecklistTemplate);
}

export async function listInspectionChecklistResults(input: {
  inspectionId: string;
  actorRole: AuthRole;
  actorUserId: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<PublicChecklistResult[]> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  const results = await prisma.inspectionChecklistResult.findMany({
    where: { inspectionId: input.inspectionId },
    include: {
      template: {
        select: {
          code: true,
          id: true,
          module: true,
          title: true,
        },
      },
    },
    orderBy: [{ template: { sortOrder: "asc" } }, { createdAt: "asc" }],
  });

  return results.map(toPublicChecklistResult);
}

export async function upsertInspectionChecklistResult(input: {
  actorRole: AuthRole;
  actorUserId: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
  remarks?: string;
  status: ChecklistResultStatus;
  templateId: string;
}): Promise<PublicChecklistResult> {
  const inspection = await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );
  const template = await ensureChecklistTemplate(input.templateId);

  // Prefer an exact inspection-level moduleCode match; fall back to the
  // office-level check for legacy inspections that have no moduleCode yet.
  if (inspection.moduleCode) {
    if (template.module !== inspection.moduleCode) {
      throw new AppError(
        400,
        "TEMPLATE_MODULE_MISMATCH",
        "Checklist template does not belong to this inspection's module",
      );
    }
  } else {
    const officeModuleCodes = inspection.office.moduleAssignments.map(
      (a) => a.module.code,
    );
    if (
      officeModuleCodes.length > 0 &&
      !officeModuleCodes.includes(template.module)
    ) {
      throw new AppError(
        400,
        "TEMPLATE_MODULE_MISMATCH",
        "Checklist template does not belong to the inspection office's module",
      );
    }
  }

  const templateSnapshot = {
    id: template.id,
    code: template.code,
    title: template.title,
    description: template.description,
    module: template.module,
    sortOrder: template.sortOrder,
    version: template.version,
  };

  const result = await prisma.inspectionChecklistResult.upsert({
    where: {
      inspectionId_templateId: {
        inspectionId: input.inspectionId,
        templateId: input.templateId,
      },
    },
    create: {
      inspectionId: input.inspectionId,
      remarks: input.remarks?.trim() || null,
      status: input.status,
      templateId: input.templateId,
      templateVersion: template.version,
      templateSnapshot,
    },
    update: {
      remarks: input.remarks?.trim() || null,
      status: input.status,
    },
    include: {
      template: {
        select: {
          code: true,
          id: true,
          module: true,
          title: true,
        },
      },
    },
  });

  await recordAuditLog({
    action: "inspection.checklist_result_recorded",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    detail: `Recorded ${result.template.code} as ${result.status.toLowerCase()}`,
    entityId: result.id,
    entityType: "checklist_result",
    summary: `Checklist result recorded for inspection ${input.inspectionId}`,
  });

  return toPublicChecklistResult(result);
}

export async function listFindings(input: {
  actorRole: AuthRole;
  actorUserId: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
  severity?: FindingSeverity;
}): Promise<PublicFinding[]> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  const findings = await prisma.finding.findMany({
    where: {
      inspectionId: input.inspectionId,
      ...(input.severity ? { severity: input.severity } : {}),
    },
    orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
  });

  return findings.map(toPublicFinding);
}

export async function createFinding(input: {
  accuracyMeters?: number;
  actorRole: AuthRole;
  actorUserId: string;
  checklistResultId?: string;
  correctiveAction?: string;
  description: string;
  dueDate?: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
  latitude?: number;
  longitude?: number;
  severity: FindingSeverity;
  title: string;
}): Promise<PublicFinding> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  if (input.checklistResultId) {
    await ensureChecklistResultBelongsToInspection(
      input.inspectionId,
      input.checklistResultId,
    );
  }

  const finding = await prisma.finding.create({
    data: {
      checklistResultId: input.checklistResultId ?? null,
      correctiveAction: input.correctiveAction?.trim() || null,
      description: input.description.trim(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      inspectionId: input.inspectionId,
      ...buildLocationData(input),
      severity: input.severity,
      title: input.title.trim(),
    },
  });

  await recordAuditLog({
    action: "finding.created",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    detail: input.description.trim(),
    entityId: finding.id,
    entityType: "finding",
    summary: `Logged finding: ${finding.title}`,
  });

  // Fire webhook — look up lguId via office
  const inspectionMeta = await prisma.inspection.findUnique({
    where: { id: input.inspectionId },
    select: { office: { select: { lguId: true } } },
  });
  if (inspectionMeta?.office.lguId) {
    void enqueueWebhookEvent(inspectionMeta.office.lguId, "finding.raised", {
      findingId: finding.id,
      inspectionId: finding.inspectionId,
      title: finding.title,
      severity: finding.severity,
    });
  }

  return toPublicFinding(finding);
}

export async function resolveFinding(input: {
  actorRole: AuthRole;
  actorUserId: string;
  findingId: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<PublicFinding> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  const finding = await prisma.finding.findFirst({
    where: {
      id: input.findingId,
      inspectionId: input.inspectionId,
    },
  });

  if (!finding) {
    throw new AppError(404, "FINDING_NOT_FOUND", "Finding not found");
  }

  const updatedFinding = await prisma.finding.update({
    where: { id: input.findingId },
    data: {
      resolvedAt: new Date(),
    },
  });

  await recordAuditLog({
    action: "finding.resolved",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    entityId: updatedFinding.id,
    entityType: "finding",
    summary: `Resolved finding: ${updatedFinding.title}`,
  });

  return toPublicFinding(updatedFinding);
}

export async function getInspectionSummary(input: {
  actorRole: AuthRole;
  actorUserId: string;
  from?: string;
  jurisdictionScope: JurisdictionScope;
  lguId?: string;
  officeId?: string;
  to?: string;
}): Promise<PublicInspectionSummary> {
  const inspectorModuleCodes =
    input.actorRole === "inspector"
      ? await getInspectorModuleCodes(input.actorUserId)
      : undefined;
  const clauses = buildScopedInspectionClauses({
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    jurisdictionScope: input.jurisdictionScope,
    lguId: input.lguId,
    inspectorModuleCodes,
  });
  const scheduledWindowClause = buildScheduledWindowClause({
    from: input.from,
    to: input.to,
  });

  if (scheduledWindowClause) {
    clauses.push(scheduledWindowClause);
  }

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  }

  const baseWhere = clauses.length === 0 ? {} : { AND: clauses };

  const [scheduled, inProgress, completed, overdue, canceled] =
    await Promise.all([
      prisma.inspection.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
      prisma.inspection.count({
        where: { ...baseWhere, status: "IN_PROGRESS" },
      }),
      prisma.inspection.count({ where: { ...baseWhere, status: "COMPLETED" } }),
      prisma.inspection.count({ where: { ...baseWhere, status: "OVERDUE" } }),
      prisma.inspection.count({ where: { ...baseWhere, status: "CANCELED" } }),
    ]);

  return {
    canceled,
    completed,
    inProgress,
    overdue,
    scheduled,
    total: scheduled + inProgress + completed + overdue + canceled,
  };
}

export interface InspectionsByOfficeRow {
  canceled: number;
  completed: number;
  inProgress: number;
  officeId: string;
  officeName: string;
  overdue: number;
  scheduled: number;
  total: number;
}

export async function getInspectionsByOffice(input: {
  actorRole: AuthRole;
  actorUserId: string;
  from?: string;
  jurisdictionScope: JurisdictionScope;
  lguId?: string;
  to?: string;
}): Promise<InspectionsByOfficeRow[]> {
  const inspectorModuleCodes =
    input.actorRole === "inspector"
      ? await getInspectorModuleCodes(input.actorUserId)
      : undefined;
  const clauses = buildScopedInspectionClauses({
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    jurisdictionScope: input.jurisdictionScope,
    lguId: input.lguId,
    inspectorModuleCodes,
  });
  const scheduledWindowClause = buildScheduledWindowClause({
    from: input.from,
    to: input.to,
  });

  if (scheduledWindowClause) {
    clauses.push(scheduledWindowClause);
  }

  const baseWhere = clauses.length === 0 ? {} : { AND: clauses };

  const grouped = await prisma.inspection.groupBy({
    by: ["officeId", "status"],
    where: baseWhere,
    _count: { _all: true },
  });

  if (grouped.length === 0) {
    return [];
  }

  const officeIds = [...new Set(grouped.map((row) => row.officeId))];
  const offices = await prisma.office.findMany({
    where: { id: { in: officeIds } },
    select: { id: true, name: true },
  });

  const officeNames = new Map(offices.map((o) => [o.id, o.name]));

  const aggregated = new Map<string, InspectionsByOfficeRow>();

  for (const row of grouped) {
    if (!aggregated.has(row.officeId)) {
      aggregated.set(row.officeId, {
        canceled: 0,
        completed: 0,
        inProgress: 0,
        officeId: row.officeId,
        officeName: officeNames.get(row.officeId) ?? row.officeId,
        overdue: 0,
        scheduled: 0,
        total: 0,
      });
    }

    const entry = aggregated.get(row.officeId)!;
    const count = row._count._all;

    entry.total += count;

    if (row.status === "SCHEDULED") {
      entry.scheduled += count;
    } else if (row.status === "IN_PROGRESS") {
      entry.inProgress += count;
    } else if (row.status === "COMPLETED") {
      entry.completed += count;
    } else if (row.status === "OVERDUE") {
      entry.overdue += count;
    } else if (row.status === "CANCELED") {
      entry.canceled += count;
    }
  }

  return [...aggregated.values()].sort((a, b) =>
    a.officeName.localeCompare(b.officeName),
  );
}

export async function listInspectionMapPoints(input: {
  actorRole: AuthRole;
  actorUserId: string;
  from?: string;
  jurisdictionScope: JurisdictionScope;
  lguId?: string;
  officeId?: string;
  status?: Inspection["status"];
  to?: string;
}): Promise<PublicInspectionMapPoint[]> {
  const inspectorModuleCodes =
    input.actorRole === "inspector"
      ? await getInspectorModuleCodes(input.actorUserId)
      : undefined;
  const clauses = buildScopedInspectionClauses({
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    jurisdictionScope: input.jurisdictionScope,
    lguId: input.lguId,
    inspectorModuleCodes,
  });
  const scheduledWindowClause = buildScheduledWindowClause({
    from: input.from,
    to: input.to,
  });

  if (scheduledWindowClause) {
    clauses.push(scheduledWindowClause);
  }

  if (input.officeId) {
    clauses.push({ officeId: input.officeId });
  }

  if (input.status) {
    clauses.push({ status: input.status });
  }

  clauses.push({
    locationLatitude: { not: null },
    locationLongitude: { not: null },
  });

  const points = await prisma.inspection.findMany({
    orderBy: { scheduledAt: "asc" },
    select: {
      business: {
        select: {
          businessName: true,
          id: true,
        },
      },
      id: true,
      locationAccuracyMeters: true,
      locationLatitude: true,
      locationLongitude: true,
      office: {
        select: {
          code: true,
          id: true,
          lguId: true,
          name: true,
        },
      },
      scheduledAt: true,
      status: true,
    },
    take: 200,
    where: { AND: clauses },
  });

  return points.map(toPublicInspectionMapPoint);
}

export async function listInspectionHistory(input: {
  actorRole: AuthRole;
  actorUserId: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<PublicInspectionHistoryEvent[]> {
  const inspection = await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  const [attachments, checklistResults, findings] = await Promise.all([
    prisma.attachment.findMany({
      where: { inspectionId: input.inspectionId },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.inspectionChecklistResult.findMany({
      where: { inspectionId: input.inspectionId },
      include: {
        template: {
          select: {
            code: true,
            title: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.finding.findMany({
      where: { inspectionId: input.inspectionId },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const events: PublicInspectionHistoryEvent[] = [
    {
      entityId: inspection.id,
      occurredAt: inspection.createdAt.toISOString(),
      title: `Inspection record created for ${inspection.business.businessName}`,
      type: "inspection_created",
    },
    ...(inspection.startedAt
      ? [
          {
            entityId: inspection.id,
            occurredAt: inspection.startedAt.toISOString(),
            title: "Inspection started in the field",
            type: "inspection_started" as const,
          },
        ]
      : []),
    ...(inspection.completedAt
      ? [
          {
            detail: `Final status: ${inspection.status.toLowerCase()}`,
            entityId: inspection.id,
            occurredAt: inspection.completedAt.toISOString(),
            title: "Inspection marked completed",
            type: "inspection_completed" as const,
          },
        ]
      : []),
    ...checklistResults.map((result) => ({
      detail: result.remarks ?? undefined,
      entityId: result.id,
      occurredAt: result.updatedAt.toISOString(),
      title: `Checklist ${result.template.code} recorded as ${result.status.toLowerCase().replace(/_/g, " ")}`,
      type: "checklist_result_recorded" as const,
    })),
    ...findings.flatMap((finding) => [
      {
        detail: finding.description,
        entityId: finding.id,
        occurredAt: finding.createdAt.toISOString(),
        title: `Finding logged: ${finding.title}`,
        type: "finding_logged" as const,
      },
      ...(finding.resolvedAt
        ? [
            {
              entityId: finding.id,
              occurredAt: finding.resolvedAt.toISOString(),
              title: `Finding resolved: ${finding.title}`,
              type: "finding_resolved" as const,
            },
          ]
        : []),
    ]),
    ...attachments.map((attachment) => ({
      detail: attachment.mimeType,
      entityId: attachment.id,
      occurredAt: attachment.createdAt.toISOString(),
      title: `Attachment stored: ${attachment.fileName}`,
      type: "attachment_uploaded" as const,
    })),
  ];

  return events.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  );
}

export async function listAttachments(input: {
  actorRole: AuthRole;
  actorUserId: string;
  findingId?: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<PublicAttachment[]> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  if (input.findingId) {
    await ensureFindingBelongsToInspection(input.inspectionId, input.findingId);
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      inspectionId: input.inspectionId,
      ...(input.findingId ? { findingId: input.findingId } : {}),
    },
    orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
  });

  return attachments.map(toPublicAttachment);
}

export async function createAttachment(input: {
  accuracyMeters?: number;
  actorRole: AuthRole;
  actorUserId: string;
  capturedAt?: string;
  fileName: string;
  fileSizeBytes: number;
  findingId?: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
  latitude?: number;
  longitude?: number;
  mimeType: string;
  storageKey: string;
}): Promise<PublicAttachment> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  if (input.findingId) {
    await ensureFindingBelongsToInspection(input.inspectionId, input.findingId);
  }

  const attachment = await prisma.attachment.create({
    data: {
      capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
      fileName: input.fileName.trim(),
      fileSizeBytes: input.fileSizeBytes,
      findingId: input.findingId ?? null,
      inspectionId: input.inspectionId,
      ...buildLocationData(input),
      mimeType: input.mimeType.trim(),
      storageKey: input.storageKey.trim(),
    },
  });

  await recordAuditLog({
    action: "attachment.uploaded",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    detail: attachment.mimeType,
    entityId: attachment.id,
    entityType: "attachment",
    summary: `Uploaded attachment: ${attachment.fileName}`,
  });

  return toPublicAttachment(attachment);
}

export async function createAttachmentUploadIntent(input: {
  actorRole: AuthRole;
  actorUserId: string;
  fileName: string;
  findingId?: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<PublicAttachmentUploadIntent> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  if (input.findingId) {
    await ensureFindingBelongsToInspection(input.inspectionId, input.findingId);
  }

  const provider = getAttachmentStorageProvider();
  const intent = await provider.createUploadIntent({
    fileName: input.fileName,
    inspectionId: input.inspectionId,
  });

  return intent;
}

export async function createAttachmentDownloadIntent(input: {
  actorRole: AuthRole;
  actorUserId: string;
  attachmentId: string;
  inspectionId: string;
  jurisdictionScope?: JurisdictionScope;
}): Promise<PublicAttachmentDownloadIntent> {
  await ensureAccessibleInspection(
    input.inspectionId,
    input.actorRole,
    input.actorUserId,
    input.jurisdictionScope,
  );

  const attachment = await prisma.attachment.findUnique({
    where: {
      id: input.attachmentId,
    },
  });

  if (!attachment || attachment.inspectionId !== input.inspectionId) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }

  const provider = getAttachmentStorageProvider();

  return provider.createDownloadIntent({
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    storageKey: attachment.storageKey,
  });
}

export interface RequestReinspectionInput {
  actorRole: AuthRole;
  actorUserId: string;
  inspectionId: string;
  reason?: string;
}

export async function requestReinspection(
  input: RequestReinspectionInput,
): Promise<{ inspectionId: string }> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: input.inspectionId },
    select: {
      id: true,
      status: true,
      business: { select: { ownerUsers: { select: { id: true } } } },
    },
  });

  if (!inspection) {
    throw new AppError(404, "INSPECTION_NOT_FOUND", "Inspection not found");
  }

  const isOwner = inspection.business.ownerUsers.some(
    (u) => u.id === input.actorUserId,
  );

  if (!isOwner) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have access to this inspection",
    );
  }

  if (inspection.status !== "COMPLETED") {
    throw new AppError(
      400,
      "INSPECTION_NOT_COMPLETED",
      "Reinspection can only be requested for completed inspections",
    );
  }

  await recordAuditLog({
    action: "reinspection.requested",
    actorRole: input.actorRole,
    actorUserId: input.actorUserId,
    detail: input.reason?.trim() || undefined,
    entityId: input.inspectionId,
    entityType: "inspection",
    summary: "Business owner requested a reinspection",
  });

  return { inspectionId: input.inspectionId };
}

export interface BulkCreateInspectionItem {
  businessId: string;
  inspectorId?: string;
  moduleCode?: string;
  notes?: string;
  officeId: string;
  permitRecordId: string;
  scheduledAt: string;
}

export async function bulkCreateInspections(input: {
  actorRole: AuthRole;
  actorUserId: string;
  items: BulkCreateInspectionItem[];
}): Promise<PublicInspection[]> {
  const MAX_BULK = 50;

  if (input.items.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "items must not be empty");
  }

  if (input.items.length > MAX_BULK) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Bulk create is limited to ${MAX_BULK} inspections`,
    );
  }

  // Pre-flight validation for each item (mirrors createInspection guards)
  for (const item of input.items) {
    await ensurePermitMatchesBusiness(item.businessId, item.permitRecordId);
    await ensureOfficeExists(item.officeId);
    if (item.inspectorId) {
      await ensureInspectionAssignee(item.inspectorId);
      await ensureInspectorCanOperateOffice(item.inspectorId, item.officeId);
      if (item.moduleCode) {
        await ensureInspectorModuleAccess(
          item.inspectorId,
          item.moduleCode.trim().toUpperCase(),
          item.officeId,
        );
      }
    }
  }

  const created = await prisma.$transaction(
    input.items.map((item) =>
      prisma.inspection.create({
        data: {
          businessId: item.businessId,
          inspectorId: item.inspectorId ?? null,
          moduleCode: item.moduleCode?.trim().toUpperCase() ?? null,
          notes: item.notes?.trim() ?? null,
          officeId: item.officeId,
          permitRecordId: item.permitRecordId,
          scheduledAt: new Date(item.scheduledAt),
          status: "SCHEDULED",
        },
        include: INSPECTION_INCLUDE,
      }),
    ),
  );

  await prisma.auditLog.createMany({
    data: created.map((insp) => ({
      action: "inspection.created",
      actorUserId: input.actorUserId,
      entityId: insp.id,
      entityType: "inspection",
      summary: `Inspection scheduled for ${insp.business.businessName} (bulk)`,
    })),
  });

  return created.map(toPublicInspection);
}

export async function bulkAssignInspections(input: {
  actorRole: AuthRole;
  actorUserId: string;
  inspectionIds: string[];
  inspectorId: string;
}): Promise<{ updated: number }> {
  const MAX_BULK = 50;

  if (input.inspectionIds.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "inspectionIds must not be empty",
    );
  }

  if (input.inspectionIds.length > MAX_BULK) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Bulk assign is limited to ${MAX_BULK} inspections`,
    );
  }

  const inspector = await prisma.user.findUnique({
    where: { id: input.inspectorId },
    select: { id: true, role: true },
  });

  if (!inspector) {
    throw new AppError(404, "NOT_FOUND", "Inspector not found");
  }

  if (inspector.role !== ("INSPECTOR" satisfies UserRole)) {
    throw new AppError(
      400,
      "INVALID_ROLE",
      "The specified user is not an inspector",
    );
  }

  // Validate the inspector is assigned to every office touched by these inspections
  const targetInspections = await prisma.inspection.findMany({
    where: { id: { in: input.inspectionIds } },
    select: { officeId: true, moduleCode: true },
  });

  const uniqueOfficeIds = [
    ...new Set(targetInspections.map((i) => i.officeId)),
  ];

  for (const officeId of uniqueOfficeIds) {
    await ensureInspectorCanOperateOffice(input.inspectorId, officeId);
  }

  // Verify module compatibility for every unique (officeId, moduleCode) pair.
  const seenPairs = new Set<string>();
  for (const inspection of targetInspections) {
    if (!inspection.moduleCode) continue;
    const key = `${inspection.officeId}:${inspection.moduleCode}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    await ensureInspectorModuleAccess(
      input.inspectorId,
      inspection.moduleCode,
      inspection.officeId,
    );
  }

  const result = await prisma.inspection.updateMany({
    where: {
      id: { in: input.inspectionIds },
      status: { in: ["SCHEDULED", "OVERDUE"] },
    },
    data: { inspectorId: input.inspectorId },
  });

  await prisma.auditLog.createMany({
    data: input.inspectionIds.map((id) => ({
      action: "inspection.assigned",
      actorUserId: input.actorUserId,
      entityId: id,
      entityType: "inspection",
      summary: `Inspection bulk-assigned to inspector ${input.inspectorId}`,
    })),
  });

  return { updated: result.count };
}
