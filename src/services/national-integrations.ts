import type { NationalVerificationKind, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { recordAuditLog } from "./audit-logs.js";
import {
  getNationalIntegrationProvider,
  isTinFormatValid,
  isPcnFormatValid,
  normalizeTin,
  type BusinessNameMatch,
  type DisasterAlert,
  type PcnVerifyResult,
  type TinVerifyResult,
} from "../lib/national-integration-provider.js";

// Cache TTL: 7 days (in ms)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getCachedVerification(
  kind: NationalVerificationKind,
  referenceValue: string,
) {
  const record = await prisma.nationalVerificationRecord.findFirst({
    orderBy: { createdAt: "desc" },
    where: {
      expiresAt: { gt: new Date() },
      kind,
      referenceValue,
    },
  });
  return record;
}

// ---------------------------------------------------------------------------
// PCN (PhilSys) verification
// ---------------------------------------------------------------------------

export async function verifyPhilSysPcn(input: {
  assertedName: string;
  businessId?: string;
  pcn: string;
  requestedByUserId?: string;
}): Promise<PcnVerifyResult & { id: string }> {
  const cleanedPcn = input.pcn.replace(/\s/g, "");

  if (!isPcnFormatValid(cleanedPcn)) {
    throw new AppError(
      422,
      "INVALID_PCN_FORMAT",
      "PCN must be exactly 12 digits",
    );
  }

  // Check cache
  const cached = await getCachedVerification("PCN", cleanedPcn);
  if (cached) {
    return {
      id: cached.id,
      ...(cached.result as unknown as PcnVerifyResult),
    };
  }

  const provider = getNationalIntegrationProvider();
  const result = await provider.verifyPcn(cleanedPcn, input.assertedName);

  const record = await prisma.nationalVerificationRecord.create({
    data: {
      businessId: input.businessId ?? null,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      kind: "PCN",
      providerSource: result.providerSource,
      referenceValue: cleanedPcn,
      requestedByUserId: input.requestedByUserId ?? null,
      result: result as unknown as Prisma.InputJsonObject,
      verified: result.verified,
    },
  });

  await recordAuditLog({
    action: "national.pcn_verified",
    actorUserId: input.requestedByUserId,
    detail: `PCN ${cleanedPcn} — verified: ${String(result.verified)} via ${result.providerSource}`,
    entityId: record.id,
    entityType: "national_verification",
    summary: `PhilSys PCN verification`,
  });

  return { id: record.id, ...result };
}

// ---------------------------------------------------------------------------
// TIN (BIR) verification
// ---------------------------------------------------------------------------

export async function verifyBirTin(input: {
  assertedBusinessName: string;
  businessId?: string;
  requestedByUserId?: string;
  tin: string;
}): Promise<TinVerifyResult & { id: string }> {
  const normalized = normalizeTin(input.tin);

  if (!isTinFormatValid(normalized)) {
    throw new AppError(
      422,
      "INVALID_TIN_FORMAT",
      "TIN must be in XXX-XXX-XXX or XXX-XXX-XXX-XXXXX format",
    );
  }

  const cached = await getCachedVerification("TIN", normalized);
  if (cached) {
    return { id: cached.id, ...(cached.result as unknown as TinVerifyResult) };
  }

  const provider = getNationalIntegrationProvider();
  const result = await provider.verifyTin(normalized, input.assertedBusinessName);

  const record = await prisma.nationalVerificationRecord.create({
    data: {
      businessId: input.businessId ?? null,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      kind: "TIN",
      providerSource: result.providerSource,
      referenceValue: normalized,
      requestedByUserId: input.requestedByUserId ?? null,
      result: result as unknown as Prisma.InputJsonObject,
      verified: result.verified,
    },
  });

  await recordAuditLog({
    action: "national.tin_verified",
    actorUserId: input.requestedByUserId,
    detail: `TIN ${normalized} — verified: ${String(result.verified)} via ${result.providerSource}`,
    entityId: record.id,
    entityType: "national_verification",
    summary: `BIR TIN verification`,
  });

  return { id: record.id, ...result };
}

// ---------------------------------------------------------------------------
// Business name lookup (DTI/SEC)
// ---------------------------------------------------------------------------

export async function lookupBusinessName(input: {
  query: string;
  requestedByUserId?: string;
  type?: "ALL" | "DTI" | "SEC";
}): Promise<BusinessNameMatch[]> {
  if (!input.query || input.query.trim().length < 2) {
    throw new AppError(422, "QUERY_TOO_SHORT", "Query must be at least 2 characters");
  }

  const type = input.type ?? "ALL";

  // Also search our local business DB for matches
  const localMatches = await prisma.businessEstablishment.findMany({
    select: {
      businessName: true,
      id: true,
      ownerName: true,
    },
    take: 10,
    where: {
      archivedAt: null,
      businessName: { contains: input.query, mode: "insensitive" },
    },
  });

  const localResults: BusinessNameMatch[] = localMatches.map((b) => ({
    name: b.businessName,
    owner: b.ownerName,
    registeredAt: null,
    registrationNumber: b.id,
    status: "ACTIVE" as const,
    type: "DTI" as const,
  }));

  const provider = getNationalIntegrationProvider();
  const providerResults = await provider.lookupBusinessName(input.query, type);

  await recordAuditLog({
    action: "national.business_name_lookup",
    actorUserId: input.requestedByUserId,
    detail: `Query: "${input.query}" type: ${type}`,
    entityType: "national_verification",
    summary: `Business name lookup`,
  });

  // Merge: local first, then external, dedup by registration number
  const seen = new Set(localResults.map((r) => r.registrationNumber));
  const merged = [
    ...localResults,
    ...providerResults.filter((r) => !seen.has(r.registrationNumber)),
  ];

  return merged;
}

// ---------------------------------------------------------------------------
// Disaster alerts (PAGASA / PHIVOLCS / NDRRMC)
// ---------------------------------------------------------------------------

export async function getDisasterAlerts(input: {
  region?: string;
  requestedByUserId?: string;
}): Promise<DisasterAlert[]> {
  const provider = getNationalIntegrationProvider();
  const alerts = await provider.getDisasterAlerts(input.region);

  if (alerts.length > 0) {
    await recordAuditLog({
      action: "national.disaster_alert_fetch",
      actorUserId: input.requestedByUserId,
      detail: `${String(alerts.length)} alerts fetched${input.region ? ` for region: ${input.region}` : ""}`,
      entityType: "national_verification",
      summary: `Disaster alert fetch`,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Verification history
// ---------------------------------------------------------------------------

export async function listVerificationHistory(input: {
  businessId?: string;
  kind?: NationalVerificationKind;
  limit: number;
  page: number;
  skip: number;
}): Promise<{
  items: {
    createdAt: string;
    id: string;
    kind: NationalVerificationKind;
    providerSource: string;
    referenceValue: string;
    verified: boolean;
  }[];
  total: number;
}> {
  const where = {
    ...(input.businessId ? { businessId: input.businessId } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.nationalVerificationRecord.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        id: true,
        kind: true,
        providerSource: true,
        referenceValue: true,
        verified: true,
      },
      skip: input.skip,
      take: input.limit,
      where,
    }),
    prisma.nationalVerificationRecord.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
  };
}
