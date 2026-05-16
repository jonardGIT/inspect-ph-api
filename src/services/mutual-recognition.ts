import crypto from "node:crypto";

import type { CrossLguRecognitionStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { recordAuditLog } from "./audit-logs.js";
import { createListMeta, parsePaginationQuery } from "../lib/request.js";

// ---------------------------------------------------------------------------
// Signing helpers
// ---------------------------------------------------------------------------

function getSigningSecret(): string {
  return (
    process.env["MUTUAL_RECOGNITION_SECRET"] ??
    "dev-only-insecure-recognition-secret"
  );
}

function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
}

export function verifyRecognitionSignature(
  signedPayload: string,
  signature: string,
): boolean {
  const expected = signPayload(signedPayload);
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public output shape
// ---------------------------------------------------------------------------

export interface RecognitionRequestPublic {
  id: string;
  certificateNumber: string;
  businessName: string;
  status: CrossLguRecognitionStatus;
  requestingLgu: { id: string; name: string; code: string };
  issuingLgu: { id: string; name: string; code: string } | null;
  complianceScore: number | null;
  complianceGrade: string | null;
  signedPayload: string | null;
  signature: string | null;
  consentGivenAt: string | null;
  resolvedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Create recognition request (requesting LGU admin initiates)
// ---------------------------------------------------------------------------

export interface CreateRecognitionRequestInput {
  requestingLguId: string;
  certificateNumber: string;
  requestedByUserId: string;
}

export async function createRecognitionRequest(
  input: CreateRecognitionRequestInput,
): Promise<RecognitionRequestPublic> {
  // Resolve the certificate and its associated business + owner
  const cert = await prisma.fireSafetyCertificate.findUnique({
    include: {
      inspection: {
        include: {
          office: { include: { lgu: true } },
          permitRecord: {
            include: {
              business: {
                include: {
                  ownerUsers: { select: { id: true } },
                },
              },
            },
          },
        },
      },
    },
    where: { certificateNumber: input.certificateNumber },
  });

  if (!cert) {
    throw new AppError(404, "CERT_NOT_FOUND", "Certificate not found");
  }

  const issuingLgu = cert.inspection.office.lgu;

  if (issuingLgu.id === input.requestingLguId) {
    throw new AppError(
      422,
      "SAME_LGU",
      "Requesting and issuing LGU must be different",
    );
  }

  const business = cert.inspection.permitRecord?.business;
  const owners = business?.ownerUsers ?? [];
  const consentOwnerId = owners[0]?.id ?? null;

  // Recognition expires when the certificate expires (or in 1 year if no expiry)
  const expiresAt =
    cert.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const request = await prisma.crossLguRecognitionRequest.create({
    data: {
      businessName: business?.businessName ?? "Unknown",
      certificateNumber: input.certificateNumber,
      consentOwnerId,
      expiresAt,
      issuingLguId: issuingLgu.id,
      requestedByUserId: input.requestedByUserId,
      requestingLguId: input.requestingLguId,
    },
    include: {
      issuingLgu: true,
      requestingLgu: true,
    },
  });

  await recordAuditLog({
    action: "recognition.requested",
    actorUserId: input.requestedByUserId,
    entityId: request.id,
    entityType: "recognition_request",
    summary: `Recognition requested for certificate ${input.certificateNumber} from ${issuingLgu.name}`,
  });

  return toPublic(request);
}

// ---------------------------------------------------------------------------
// Business owner responds to consent request
// ---------------------------------------------------------------------------

export async function respondToConsent(
  requestId: string,
  ownerId: string,
  decision: "grant" | "deny",
): Promise<RecognitionRequestPublic> {
  const existing = await prisma.crossLguRecognitionRequest.findUnique({
    include: { issuingLgu: true, requestingLgu: true },
    where: { id: requestId },
  });

  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Recognition request not found");
  }

  if (existing.consentOwnerId !== ownerId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only the business owner can respond to consent",
    );
  }

  if (existing.status !== "PENDING_CONSENT") {
    throw new AppError(
      422,
      "WRONG_STATUS",
      `Request is already ${existing.status}`,
    );
  }

  if (existing.expiresAt < new Date()) {
    throw new AppError(422, "EXPIRED", "Recognition request has expired");
  }

  if (decision === "deny") {
    const updated = await prisma.crossLguRecognitionRequest.update({
      data: {
        resolvedAt: new Date(),
        resolvedByUserId: ownerId,
        status: "REJECTED",
      },
      include: { issuingLgu: true, requestingLgu: true },
      where: { id: requestId },
    });

    await recordAuditLog({
      action: "recognition.consent_denied",
      actorUserId: ownerId,
      entityId: requestId,
      entityType: "recognition_request",
      summary: `Business owner denied consent for recognition request ${requestId}`,
    });

    return toPublic(updated);
  }

  // Grant: generate signed payload
  // Look up compliance score lazily
  const { computeComplianceScore } = await import("./compliance-score.js");

  let complianceScore: number | null = null;
  let complianceGrade: string | null = null;

  // Find the business via the certificate
  const cert = await prisma.fireSafetyCertificate.findUnique({
    include: {
      inspection: {
        include: { permitRecord: { include: { business: true } } },
      },
    },
    where: { certificateNumber: existing.certificateNumber },
  });

  if (cert?.inspection.permitRecord?.business) {
    try {
      const scoreResult = await computeComplianceScore(
        cert.inspection.permitRecord.business.id,
      );
      complianceScore = scoreResult.score;
      complianceGrade = scoreResult.grade;
    } catch {
      // non-fatal — proceed without score
    }
  }

  const issuingLguCode = existing.issuingLgu?.code ?? "";
  const issuingLguName = existing.issuingLgu?.name ?? "";

  const payloadObj = {
    certificateNumber: existing.certificateNumber,
    businessName: existing.businessName,
    issuingLguCode,
    issuingLguName,
    requestingLguId: existing.requestingLguId,
    complianceScore,
    complianceGrade,
    recognitionGrantedAt: new Date().toISOString(),
    expiresAt: existing.expiresAt.toISOString(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const signedPayload = JSON.stringify(payloadObj);
  const signature = signPayload(signedPayload);

  const updated = await prisma.crossLguRecognitionRequest.update({
    data: {
      complianceGrade,
      complianceScore,
      consentGivenAt: new Date(),
      signature,
      signedPayload,
      status: "CONSENT_GRANTED",
    },
    include: { issuingLgu: true, requestingLgu: true },
    where: { id: requestId },
  });

  await recordAuditLog({
    action: "recognition.consent_granted",
    actorUserId: ownerId,
    entityId: requestId,
    entityType: "recognition_request",
    summary: `Business owner granted consent for recognition request ${requestId}`,
  });

  return toPublic(updated);
}

// ---------------------------------------------------------------------------
// Issuing LGU admin resolves the request (approve or reject)
// ---------------------------------------------------------------------------

export async function resolveRecognitionRequest(
  requestId: string,
  resolverUserId: string,
  decision: "approve" | "reject",
): Promise<RecognitionRequestPublic> {
  const existing = await prisma.crossLguRecognitionRequest.findUnique({
    include: { issuingLgu: true, requestingLgu: true },
    where: { id: requestId },
  });

  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Recognition request not found");
  }

  if (existing.status !== "CONSENT_GRANTED") {
    throw new AppError(
      422,
      "WRONG_STATUS",
      "Request must have consent before it can be resolved",
    );
  }

  const newStatus = decision === "approve" ? "APPROVED" : ("REJECTED" as const);

  const updated = await prisma.crossLguRecognitionRequest.update({
    data: {
      resolvedAt: new Date(),
      resolvedByUserId: resolverUserId,
      status: newStatus,
    },
    include: { issuingLgu: true, requestingLgu: true },
    where: { id: requestId },
  });

  await recordAuditLog({
    action:
      decision === "approve" ? "recognition.approved" : "recognition.rejected",
    actorUserId: resolverUserId,
    entityId: requestId,
    entityType: "recognition_request",
    summary: `Recognition request ${requestId} ${decision}d by LGU admin`,
  });

  return toPublic(updated);
}

// ---------------------------------------------------------------------------
// List recognition requests (scoped to caller's LGU)
// ---------------------------------------------------------------------------

export interface ListRecognitionRequestsInput {
  lguId: string;
  role: "requesting" | "issuing" | "both";
  status?: CrossLguRecognitionStatus;
  query: Record<string, unknown>;
}

export async function listRecognitionRequests(
  input: ListRecognitionRequestsInput,
): Promise<{
  items: RecognitionRequestPublic[];
  total: number;
  page: number;
  limit: number;
}> {
  const { limit, page, skip } = parsePaginationQuery(input.query);

  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.role === "requesting"
      ? { requestingLguId: input.lguId }
      : input.role === "issuing"
        ? { issuingLguId: input.lguId }
        : {
            OR: [
              { requestingLguId: input.lguId },
              { issuingLguId: input.lguId },
            ],
          }),
  };

  const [rows, total] = await Promise.all([
    prisma.crossLguRecognitionRequest.findMany({
      include: { issuingLgu: true, requestingLgu: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      where,
    }),
    prisma.crossLguRecognitionRequest.count({ where }),
  ]);

  return { items: rows.map(toPublic), ...createListMeta(total, page, limit) };
}

// ---------------------------------------------------------------------------
// Get single request
// ---------------------------------------------------------------------------

export async function getRecognitionRequest(
  id: string,
): Promise<RecognitionRequestPublic> {
  const r = await prisma.crossLguRecognitionRequest.findUnique({
    include: { issuingLgu: true, requestingLgu: true },
    where: { id },
  });

  if (!r) {
    throw new AppError(404, "NOT_FOUND", "Recognition request not found");
  }

  return toPublic(r);
}

// ---------------------------------------------------------------------------
// Business owner: list their pending consent requests
// ---------------------------------------------------------------------------

export async function listPendingConsentRequests(
  ownerId: string,
): Promise<RecognitionRequestPublic[]> {
  const rows = await prisma.crossLguRecognitionRequest.findMany({
    include: { issuingLgu: true, requestingLgu: true },
    orderBy: { createdAt: "desc" },
    where: { consentOwnerId: ownerId, status: "PENDING_CONSENT" },
  });

  return rows.map(toPublic);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type RecognitionRow = {
  id: string;
  certificateNumber: string;
  businessName: string;
  status: CrossLguRecognitionStatus;
  requestingLgu: { id: string; name: string; code: string };
  issuingLgu: { id: string; name: string; code: string } | null;
  complianceScore: number | null;
  complianceGrade: string | null;
  signedPayload: string | null;
  signature: string | null;
  consentGivenAt: Date | null;
  resolvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

function toPublic(r: RecognitionRow): RecognitionRequestPublic {
  return {
    businessName: r.businessName,
    certificateNumber: r.certificateNumber,
    complianceGrade: r.complianceGrade,
    complianceScore: r.complianceScore,
    consentGivenAt: r.consentGivenAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    id: r.id,
    issuingLgu: r.issuingLgu ?? null,
    requestingLgu: r.requestingLgu,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    signature: r.signature,
    signedPayload: r.signedPayload,
    status: r.status,
  };
}
