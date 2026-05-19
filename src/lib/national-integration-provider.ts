/**
 * National integration provider interface.
 *
 * Each integration (PhilSys, BIR, DTI/SEC, LRA, PAGASA/PHIVOLCS) is
 * abstracted behind a single interface so the platform can swap between a
 * stub implementation (format-validation only, no external HTTP) and a live
 * implementation backed by real government APIs when a Data Sharing Agreement
 * (DSA) is in place.
 *
 * Environment variables
 * ---------------------
 * NATIONAL_INTEGRATION_PROVIDER  "stub" (default) | "live"
 * PHILSYS_API_URL                (live) PhilSys identity verification endpoint
 * PHILSYS_API_KEY                (live) PhilSys API key
 * BIR_API_URL                    (live) BIR TIN verification endpoint
 * BIR_API_KEY                    (live) BIR API key
 * DTI_API_URL                    (live) DTI business-name registry endpoint
 * SEC_API_URL                    (live) SEC corporation name registry endpoint
 * LRA_API_URL                    (live) LRA parcel lookup endpoint
 * PAGASA_ALERTS_URL              PAGASA/PHIVOLCS disaster-alert feed
 *                                Defaults to NDRRMC public GeoJSON feed URL
 */

export interface PcnVerifyResult {
  pcn: string;
  /** Full name registered with PhilSys */
  registeredName: string | null;
  /** Whether the name provided matches the PhilSys record */
  nameMatch: boolean;
  verified: boolean;
  providerSource: string;
}

export interface TinVerifyResult {
  tin: string;
  /** Normalised TIN in XXX-XXX-XXX[-XXXXX] form */
  normalizedTin: string;
  /** Whether the TIN follows the BIR format and (for live provider) is active */
  verified: boolean;
  registeredName: string | null;
  providerSource: string;
}

export interface BusinessNameMatch {
  name: string;
  registrationNumber: string;
  type: "DTI" | "SEC";
  status: "ACTIVE" | "CANCELLED" | "SUSPENDED" | "UNKNOWN";
  owner: string | null;
  registeredAt: string | null;
}

export interface DisasterAlert {
  id: string;
  type: "TYPHOON" | "EARTHQUAKE" | "FLOOD" | "VOLCANIC" | "OTHER";
  severity: "ADVISORY" | "WARNING" | "WATCH" | "SIGNAL_1" | "SIGNAL_2" | "SIGNAL_3" | "SIGNAL_4" | "SIGNAL_5";
  title: string;
  description: string;
  affectedAreas: string[];
  issuedAt: string;
  effectiveUntil: string | null;
  source: "PAGASA" | "PHIVOLCS" | "NDRRMC";
  url: string | null;
}

export interface NationalIntegrationProvider {
  readonly name: string;

  /** Verify a Philippine Identification System card number */
  verifyPcn(pcn: string, assertedName: string): Promise<PcnVerifyResult>;

  /** Validate and verify a BIR Tax Identification Number */
  verifyTin(tin: string, assertedBusinessName: string): Promise<TinVerifyResult>;

  /** Look up a business name in DTI and/or SEC registries */
  lookupBusinessName(
    query: string,
    type: "DTI" | "SEC" | "ALL",
  ): Promise<BusinessNameMatch[]>;

  /** Fetch active disaster alerts for a Philippine region */
  getDisasterAlerts(region?: string): Promise<DisasterAlert[]>;
}

// ---------------------------------------------------------------------------
// Helpers shared by both implementations
// ---------------------------------------------------------------------------

const TIN_REGEX = /^\d{3}-\d{3}-\d{3}(-\d{5})?$/;
const PCN_REGEX = /^\d{12}$/;

export function normalizeTin(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 12) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return raw.trim();
}

export function isTinFormatValid(tin: string): boolean {
  return TIN_REGEX.test(tin.trim());
}

export function isPcnFormatValid(pcn: string): boolean {
  return PCN_REGEX.test(pcn.replace(/\s/g, ""));
}

// ---------------------------------------------------------------------------
// Stub provider — format validation only, no external HTTP
// ---------------------------------------------------------------------------

class StubNationalIntegrationProvider implements NationalIntegrationProvider {
  readonly name = "stub";

  async verifyPcn(
    pcn: string,
    _assertedName: string,
  ): Promise<PcnVerifyResult> {
    const cleaned = pcn.replace(/\s/g, "");
    const valid = isPcnFormatValid(cleaned);
    return {
      nameMatch: false,
      pcn: cleaned,
      providerSource: "stub",
      registeredName: null,
      verified: valid,
    };
  }

  async verifyTin(
    tin: string,
    _assertedBusinessName: string,
  ): Promise<TinVerifyResult> {
    const normalized = normalizeTin(tin);
    const valid = isTinFormatValid(normalized);
    return {
      normalizedTin: normalized,
      providerSource: "stub",
      registeredName: null,
      tin,
      verified: valid,
    };
  }

  async lookupBusinessName(
    query: string,
    _type: "DTI" | "SEC" | "ALL",
  ): Promise<BusinessNameMatch[]> {
    // Stub returns no external matches; real data comes from local DB in the service
    return [
      {
        name: query,
        owner: null,
        registeredAt: null,
        registrationNumber: "STUB-000000",
        status: "UNKNOWN",
        type: "DTI",
      },
    ];
  }

  async getDisasterAlerts(region?: string): Promise<DisasterAlert[]> {
    // In stub mode, attempt to fetch from the configured public PAGASA feed URL.
    // If unavailable (CI/offline), return empty list gracefully.
    const feedUrl =
      process.env["PAGASA_ALERTS_URL"] ??
      "https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin.json";

    try {
      const res = await fetch(feedUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as unknown;
      return parsePagasaFeed(json, region);
    } catch {
      return [];
    }
  }
}

/** Best-effort PAGASA bulletin JSON → DisasterAlert[] */
function parsePagasaFeed(
  raw: unknown,
  _region: string | undefined,
): DisasterAlert[] {
  if (!raw || typeof raw !== "object") return [];
  const items = Array.isArray(raw)
    ? raw
    : "bulletins" in (raw as Record<string, unknown>)
      ? ((raw as Record<string, unknown[]>)["bulletins"] ?? [])
      : [];

  return (items as Record<string, unknown>[]).slice(0, 20).map((item, i) => ({
    affectedAreas: Array.isArray(item["areas"])
      ? (item["areas"] as string[])
      : [],
    description: String(item["description"] ?? item["remarks"] ?? ""),
    effectiveUntil: item["validUntil"]
      ? String(item["validUntil"])
      : null,
    id: String(item["id"] ?? `pagasa-${i}`),
    issuedAt: String(item["issuedAt"] ?? item["issued_at"] ?? new Date().toISOString()),
    severity: "ADVISORY" as const,
    source: "PAGASA" as const,
    title: String(item["title"] ?? item["subject"] ?? "Weather bulletin"),
    type: "TYPHOON" as const,
    url: item["url"] ? String(item["url"]) : null,
  }));
}

// ---------------------------------------------------------------------------
// Provider singleton
// ---------------------------------------------------------------------------

let _provider: NationalIntegrationProvider | null = null;

export function getNationalIntegrationProvider(): NationalIntegrationProvider {
  if (_provider) return _provider;
  const mode = process.env["NATIONAL_INTEGRATION_PROVIDER"] ?? "stub";
  // Only "stub" is implemented; "live" can be wired when DSA keys are provided.
  if (mode !== "stub") {
    console.warn(
      `NATIONAL_INTEGRATION_PROVIDER="${mode}" is not yet implemented; falling back to stub`,
    );
  }
  _provider = new StubNationalIntegrationProvider();
  return _provider;
}
