/**
 * seed-dev-full.ts
 *
 * Comprehensive development seed — populates every major table with realistic
 * Philippine LGU data so the whole app can be exercised from a single command.
 *
 *   npm run seed:dev-full
 *
 * Idempotent: every record is upserted, so re-running is safe.
 * All user passwords: password123
 */

import "../env.js";

import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

// ─── ID helpers ─────────────────────────────────────────────────────────────
// Format: 00000000-{table:04x}-4000-8001-{index:012d}
// Table slots: 1=LGU 2=Module 3=Office 4=User 5=Business 6=Permit
//              7=Inspection 8=Template 9=CklResult 10=Finding 11=CAP
//              12=FireCert 13=IssueReport 14=Payment 15=AuditLog
//              16=Notification 17=Attachment 18=DSR 19=Dispute
//              20=AnomalyFlag 21=OAuthClient 22=Recognition 23=NatVerif
//              24=Rating 25=Webhook 26=Delivery
function sid(table: number, index: number): string {
  return [
    "00000000",
    table.toString(16).padStart(4, "0"),
    "4000",
    "8001",
    index.toString().padStart(12, "0"),
  ].join("-");
}

// ─── LGU IDs ────────────────────────────────────────────────────────────────
const [L1, L2, L3, L4, L5] = Array.from({ length: 5 }, (_, i) => sid(1, i + 1));

// ─── Office IDs ─────────────────────────────────────────────────────────────
const [
  O1,
  O2,
  O3,
  O4, // TUG2 offices
  O5,
  O6,
  O7,
  O8, // CAU2 offices
  O9,
  O10,
  O11,
  O12, // SAN2 offices
  O13,
  O14,
  O15,
  O16, // ILG2 offices
  O17,
  O18,
  O19,
  O20, // APR2 offices
] = Array.from({ length: 20 }, (_, i) => sid(3, i + 1));

// ─── User IDs ────────────────────────────────────────────────────────────────
const [
  U1, // admin
  U2,
  U3,
  U4,
  U5,
  U6, // LGU admins (1 per LGU)
  U7,
  U8,
  U9, // supervisors
  U10,
  U11,
  U12, // clerks
  U13,
  U14,
  U15,
  U16,
  U17, // inspectors
  U18,
  U19,
  U20, // business owners
  U21,
  U22, // citizens
] = Array.from({ length: 22 }, (_, i) => sid(4, i + 1));

// ─── Business IDs ────────────────────────────────────────────────────────────
const BIDS = Array.from({ length: 20 }, (_, i) => sid(5, i + 1));
const [
  B1,
  B2,
  B3,
  B4,
  B5,
  B6,
  B7,
  B8,
  B9,
  B10,
  B11,
  B12,
  B13,
  B14,
  B15,
  B16,
  B17,
  B18,
  B19,
  B20,
] = BIDS;

// ─── Permit IDs ──────────────────────────────────────────────────────────────
const PIDS = Array.from({ length: 20 }, (_, i) => sid(6, i + 1));
const [
  P1,
  P2,
  P3,
  P4,
  P5,
  P6,
  P7,
  P8,
  P9,
  P10,
  P11,
  P12,
  P13,
  P14,
  P15,
  P16,
  P17,
  P18,
  P19,
  P20,
] = PIDS;

// ─── Inspection IDs ──────────────────────────────────────────────────────────
const IIDS = Array.from({ length: 20 }, (_, i) => sid(7, i + 1));
const [
  I1,
  I2,
  I3,
  I4,
  I5,
  I6,
  I7,
  I8,
  I9,
  I10,
  I11,
  I12,
  I13,
  I14,
  I15,
  I16,
  I17,
  I18,
  I19,
  I20,
] = IIDS;

// ─── Payment IDs ─────────────────────────────────────────────────────────────
const PMIDS = Array.from({ length: 20 }, (_, i) => sid(14, i + 1));

// ─── Audit Log IDs ───────────────────────────────────────────────────────────
const ALIDS = Array.from({ length: 20 }, (_, i) => sid(15, i + 1));

// ─── Notification IDs ────────────────────────────────────────────────────────
const NIDS = Array.from({ length: 20 }, (_, i) => sid(16, i + 1));

// ─── Attachment IDs ──────────────────────────────────────────────────────────
const ATIDS = Array.from({ length: 20 }, (_, i) => sid(17, i + 1));

// ─── Issue Report IDs ────────────────────────────────────────────────────────
const IRIDS = Array.from({ length: 20 }, (_, i) => sid(13, i + 1));

// ─── DSR IDs ─────────────────────────────────────────────────────────────────
const DSRIDS = Array.from({ length: 10 }, (_, i) => sid(18, i + 1));

// ─── Constants ───────────────────────────────────────────────────────────────
const NOW = new Date("2026-05-19T08:00:00.000Z");
const PASS = "password123";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}
function daysFrom(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("⏳  Seeding full dataset…");

  const pwHash = await hashPassword(PASS);

  // ── 1. LGUs (5) ────────────────────────────────────────────────────────────
  console.log("   LGUs…");
  const lguDefs = [
    {
      id: L1,
      code: "TUG2",
      name: "Tuguegarao City",
      region: "Region II",
      province: "Cagayan",
      city: "Tuguegarao City",
    },
    {
      id: L2,
      code: "CAU2",
      name: "Cauayan City",
      region: "Region II",
      province: "Isabela",
      city: "Cauayan City",
    },
    {
      id: L3,
      code: "SAN2",
      name: "Santiago City",
      region: "Region II",
      province: "Isabela",
      city: "Santiago City",
    },
    {
      id: L4,
      code: "ILG2",
      name: "Ilagan City",
      region: "Region II",
      province: "Isabela",
      city: "Ilagan City",
    },
    {
      id: L5,
      code: "APR2",
      name: "Aparri",
      region: "Region II",
      province: "Cagayan",
      city: "Aparri",
    },
  ];
  for (const l of lguDefs) {
    await prisma.lgu.upsert({
      where: { code: l.code },
      update: {
        name: l.name,
        region: l.region,
        province: l.province,
        city: l.city,
      },
      create: l,
    });
  }

  // Fetch actual LGU IDs (may differ if codes already existed)
  const lgus = await prisma.lgu.findMany({
    where: { code: { in: lguDefs.map((l) => l.code) } },
    select: { id: true, code: true },
  });
  const lguByCode = Object.fromEntries(lgus.map((l) => [l.code, l.id]));
  const tug = lguByCode["TUG2"];
  const cau = lguByCode["CAU2"];
  const san = lguByCode["SAN2"];
  const ilg = lguByCode["ILG2"];
  const apr = lguByCode["APR2"];

  // ── 2. Modules (11, upserted by code so idempotent with other seeds) ──────
  console.log("   Modules…");
  const moduleDefs = [
    {
      code: "BPLO",
      name: "Business Permit Licensing Office",
      description: "Business permit inspection operations",
    },
    {
      code: "FIRE",
      name: "FireGuard Inspect",
      description: "Fire safety inspection operations",
    },
    {
      code: "BUILD",
      name: "BuildSure Inspect",
      description: "Building code enforcement inspections",
    },
    {
      code: "SANITA",
      name: "SanitaCheck Inspect",
      description: "Sanitation and health inspections",
    },
    {
      code: "AGRI",
      name: "AgriCheck Inspect",
      description: "Agricultural compliance inspections",
    },
    {
      code: "MARKET",
      name: "MarketGuard Inspect",
      description: "Public market inspections",
    },
    {
      code: "ECOWATCH",
      name: "EcoWatch Inspect",
      description: "Environmental compliance inspections",
    },
    {
      code: "ZONE",
      name: "ZoneVerify Inspect",
      description: "Zoning and land use inspections",
    },
    {
      code: "INFRA",
      name: "InfraInspect",
      description: "Infrastructure inspections",
    },
    {
      code: "TOURISM",
      name: "TourismSafe Inspect",
      description: "Tourism establishment inspections",
    },
    {
      code: "ASSESS",
      name: "AssessPro Inspect",
      description: "Property assessment inspections",
    },
  ];
  for (const m of moduleDefs) {
    await prisma.module.upsert({
      where: { code: m.code },
      update: { name: m.name, description: m.description, isActive: true },
      create: {
        code: m.code,
        name: m.name,
        description: m.description,
        isActive: true,
      },
    });
  }
  const modules = await prisma.module.findMany({
    where: { code: { in: moduleDefs.map((m) => m.code) } },
    select: { id: true, code: true },
  });
  const modByCode = Object.fromEntries(modules.map((m) => [m.code, m.id]));

  // ── 3. Offices (20) ────────────────────────────────────────────────────────
  console.log("   Offices…");
  type OfficeDef = {
    id: string;
    lguId: string;
    code: string;
    name: string;
    description: string;
    modules: string[];
  };
  const officeDefs: OfficeDef[] = [
    // TUG2 (4)
    {
      id: O1,
      lguId: tug,
      code: "BPLO-TUG",
      name: "BPLO Office Tuguegarao",
      description: "Business permit licensing and compliance — Tuguegarao",
      modules: ["BPLO", "FIRE"],
    },
    {
      id: O2,
      lguId: tug,
      code: "BFP-TUG",
      name: "Bureau of Fire Protection Tuguegarao",
      description: "Fire safety inspection operations — Tuguegarao",
      modules: ["FIRE"],
    },
    {
      id: O3,
      lguId: tug,
      code: "OBO-TUG",
      name: "Office of Building Official Tuguegarao",
      description: "Building code enforcement — Tuguegarao",
      modules: ["BUILD"],
    },
    {
      id: O4,
      lguId: tug,
      code: "CHO-TUG",
      name: "City Health Office Tuguegarao",
      description: "Sanitation and health inspection — Tuguegarao",
      modules: ["SANITA"],
    },
    // CAU2 (4)
    {
      id: O5,
      lguId: cau,
      code: "BPLO-CAU",
      name: "BPLO Office Cauayan",
      description: "Business permit licensing — Cauayan",
      modules: ["BPLO", "MARKET"],
    },
    {
      id: O6,
      lguId: cau,
      code: "MAO-CAU",
      name: "Municipal Agricultural Office Cauayan",
      description: "Agricultural compliance — Cauayan",
      modules: ["AGRI"],
    },
    {
      id: O7,
      lguId: cau,
      code: "ENRO-CAU",
      name: "ENRO Cauayan",
      description: "Environmental and natural resources — Cauayan",
      modules: ["ECOWATCH"],
    },
    {
      id: O8,
      lguId: cau,
      code: "PMO-CAU",
      name: "Public Market Office Cauayan",
      description: "Public market and sanitation oversight — Cauayan",
      modules: ["MARKET", "SANITA"],
    },
    // SAN2 (4)
    {
      id: O9,
      lguId: san,
      code: "BPLO-SAN",
      name: "BPLO Office Santiago",
      description: "Business permit licensing — Santiago",
      modules: ["BPLO"],
    },
    {
      id: O10,
      lguId: san,
      code: "BFP-SAN",
      name: "Bureau of Fire Protection Santiago",
      description: "Fire safety inspection — Santiago",
      modules: ["FIRE"],
    },
    {
      id: O11,
      lguId: san,
      code: "CEO-SAN",
      name: "City Engineering Office Santiago",
      description: "Building and infrastructure inspection — Santiago",
      modules: ["BUILD", "INFRA"],
    },
    {
      id: O12,
      lguId: san,
      code: "CTO-SAN",
      name: "Tourism Office Santiago",
      description: "Tourism establishment accreditation — Santiago",
      modules: ["TOURISM"],
    },
    // ILG2 (4)
    {
      id: O13,
      lguId: ilg,
      code: "BPLO-ILG",
      name: "BPLO Office Ilagan",
      description: "Business permit licensing — Ilagan",
      modules: ["BPLO", "FIRE"],
    },
    {
      id: O14,
      lguId: ilg,
      code: "CAO-ILG",
      name: "City Agricultural Office Ilagan",
      description: "Agricultural compliance — Ilagan",
      modules: ["AGRI"],
    },
    {
      id: O15,
      lguId: ilg,
      code: "CENRO-ILG",
      name: "CENRO Ilagan",
      description: "Environmental compliance — Ilagan",
      modules: ["ECOWATCH"],
    },
    {
      id: O16,
      lguId: ilg,
      code: "CIO-ILG",
      name: "City Infrastructure Office Ilagan",
      description: "Infrastructure and zoning — Ilagan",
      modules: ["INFRA", "ZONE"],
    },
    // APR2 (4)
    {
      id: O17,
      lguId: apr,
      code: "BPLO-APR",
      name: "BPLO Office Aparri",
      description: "Business permit licensing — Aparri",
      modules: ["BPLO"],
    },
    {
      id: O18,
      lguId: apr,
      code: "FS-APR",
      name: "Fire Station Aparri",
      description: "Fire safety inspection — Aparri",
      modules: ["FIRE"],
    },
    {
      id: O19,
      lguId: apr,
      code: "MAO-APR",
      name: "Municipal Agricultural Office Aparri",
      description: "Agricultural and environmental compliance — Aparri",
      modules: ["AGRI", "ECOWATCH"],
    },
    {
      id: O20,
      lguId: apr,
      code: "TLO-APR",
      name: "Tourism & Livelihood Office Aparri",
      description: "Tourism establishment inspection — Aparri",
      modules: ["TOURISM"],
    },
  ];

  const officeIds: Record<string, string> = {};
  for (const o of officeDefs) {
    const office = await prisma.office.upsert({
      where: { lguId_code: { lguId: o.lguId, code: o.code } },
      update: { name: o.name, description: o.description },
      create: {
        id: o.id,
        lguId: o.lguId,
        code: o.code,
        name: o.name,
        description: o.description,
      },
    });
    officeIds[o.code] = office.id;

    for (const mc of o.modules) {
      const modId = modByCode[mc];
      if (!modId) continue;
      await prisma.officeModule.upsert({
        where: { officeId_moduleId: { officeId: office.id, moduleId: modId } },
        update: {},
        create: { officeId: office.id, moduleId: modId },
      });
    }
  }

  // ── 4. Users (22) ──────────────────────────────────────────────────────────
  console.log("   Users…");
  type UserDef = {
    id: string;
    email: string;
    name: string;
    role: string;
    lguId?: string;
  };
  const userDefs: UserDef[] = [
    {
      id: U1,
      email: "admin-full@inspectph.dev",
      name: "Reyes Admin",
      role: "ADMIN",
    },
    // LGU admins
    {
      id: U2,
      email: "lgu-admin-tug@inspectph.dev",
      name: "Antonette Cruz (TUG)",
      role: "LGU_ADMIN",
      lguId: tug,
    },
    {
      id: U3,
      email: "lgu-admin-cau@inspectph.dev",
      name: "Maricel Torres (CAU)",
      role: "LGU_ADMIN",
      lguId: cau,
    },
    {
      id: U4,
      email: "lgu-admin-san@inspectph.dev",
      name: "Eduardo Ramos (SAN)",
      role: "LGU_ADMIN",
      lguId: san,
    },
    {
      id: U5,
      email: "lgu-admin-ilg@inspectph.dev",
      name: "Rosario Dela Cruz (ILG)",
      role: "LGU_ADMIN",
      lguId: ilg,
    },
    {
      id: U6,
      email: "lgu-admin-apr@inspectph.dev",
      name: "Benjamin Guzman (APR)",
      role: "LGU_ADMIN",
      lguId: apr,
    },
    // Supervisors
    {
      id: U7,
      email: "sup-bplo-tug@inspectph.dev",
      name: "Carmen Villanueva",
      role: "OFFICE_SUPERVISOR",
      lguId: tug,
    },
    {
      id: U8,
      email: "sup-bfp-tug@inspectph.dev",
      name: "Rodrigo Aquino",
      role: "OFFICE_SUPERVISOR",
      lguId: tug,
    },
    {
      id: U9,
      email: "sup-bplo-cau@inspectph.dev",
      name: "Lilia Evangelista",
      role: "OFFICE_SUPERVISOR",
      lguId: cau,
    },
    // Clerks
    {
      id: U10,
      email: "clerk-bplo-tug@inspectph.dev",
      name: "Josefina Bautista",
      role: "OFFICE_CLERK",
      lguId: tug,
    },
    {
      id: U11,
      email: "clerk-bfp-tug@inspectph.dev",
      name: "Felix Morales",
      role: "OFFICE_CLERK",
      lguId: tug,
    },
    {
      id: U12,
      email: "clerk-bplo-cau@inspectph.dev",
      name: "Gloria Mendoza",
      role: "OFFICE_CLERK",
      lguId: cau,
    },
    // Inspectors
    {
      id: U13,
      email: "insp-a@inspectph.dev",
      name: "Ramon Castillo (A)",
      role: "INSPECTOR",
      lguId: tug,
    },
    {
      id: U14,
      email: "insp-b@inspectph.dev",
      name: "Veronica Santiago (B)",
      role: "INSPECTOR",
      lguId: tug,
    },
    {
      id: U15,
      email: "insp-c@inspectph.dev",
      name: "Andres Reyes (C)",
      role: "INSPECTOR",
      lguId: cau,
    },
    {
      id: U16,
      email: "insp-d@inspectph.dev",
      name: "Teresa Flores (D)",
      role: "INSPECTOR",
      lguId: san,
    },
    {
      id: U17,
      email: "insp-e@inspectph.dev",
      name: "Conrado Luna (E)",
      role: "INSPECTOR",
      lguId: ilg,
    },
    // Business owners
    {
      id: U18,
      email: "owner-a@inspectph.dev",
      name: "Maria Santos",
      role: "BUSINESS_OWNER",
    },
    {
      id: U19,
      email: "owner-b@inspectph.dev",
      name: "Jose Reyes",
      role: "BUSINESS_OWNER",
    },
    {
      id: U20,
      email: "owner-c@inspectph.dev",
      name: "Celia Ramos",
      role: "BUSINESS_OWNER",
    },
    // Citizens
    {
      id: U21,
      email: "citizen-a@inspectph.dev",
      name: "Ana Padilla",
      role: "CITIZEN",
    },
    {
      id: U22,
      email: "citizen-b@inspectph.dev",
      name: "Pedro Villanueva",
      role: "CITIZEN",
    },
  ];

  for (const u of userDefs) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role as never, lguId: u.lguId ?? null },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        passwordHash: pwHash,
        role: u.role as never,
        lguId: u.lguId ?? null,
      },
    });
  }

  // Fetch actual user IDs (email is the unique key)
  const userRows = await prisma.user.findMany({
    where: { email: { in: userDefs.map((u) => u.email) } },
    select: { id: true, email: true },
  });
  const userByEmail = Object.fromEntries(userRows.map((u) => [u.email, u.id]));

  const uId = (email: string) => userByEmail[email]!;
  const inspA = uId("insp-a@inspectph.dev");
  const inspB = uId("insp-b@inspectph.dev");
  const inspC = uId("insp-c@inspectph.dev");
  const inspD = uId("insp-d@inspectph.dev");
  const inspE = uId("insp-e@inspectph.dev");
  const supTug = uId("sup-bplo-tug@inspectph.dev");
  const supBfp = uId("sup-bfp-tug@inspectph.dev");
  const supCau = uId("sup-bplo-cau@inspectph.dev");
  const clkTug = uId("clerk-bplo-tug@inspectph.dev");
  const clkBfp = uId("clerk-bfp-tug@inspectph.dev");
  const clkCau = uId("clerk-bplo-cau@inspectph.dev");
  const ownerA = uId("owner-a@inspectph.dev");
  const ownerB = uId("owner-b@inspectph.dev");
  const ownerC = uId("owner-c@inspectph.dev");
  const citizA = uId("citizen-a@inspectph.dev");
  const citizB = uId("citizen-b@inspectph.dev");

  // ── 5. Office assignments for field-role users ────────────────────────────
  console.log("   User-office assignments…");
  type AssignDef = { userId: string; officeCode: string };
  const assignDefs: AssignDef[] = [
    // Supervisors
    { userId: supTug, officeCode: "BPLO-TUG" },
    { userId: supBfp, officeCode: "BFP-TUG" },
    { userId: supCau, officeCode: "BPLO-CAU" },
    // Clerks
    { userId: clkTug, officeCode: "BPLO-TUG" },
    { userId: clkBfp, officeCode: "BFP-TUG" },
    { userId: clkCau, officeCode: "BPLO-CAU" },
    // Inspectors — multi-office
    { userId: inspA, officeCode: "BPLO-TUG" },
    { userId: inspA, officeCode: "BFP-TUG" },
    { userId: inspB, officeCode: "OBO-TUG" },
    { userId: inspB, officeCode: "CHO-TUG" },
    { userId: inspC, officeCode: "BPLO-CAU" },
    { userId: inspC, officeCode: "MAO-CAU" },
    { userId: inspD, officeCode: "BPLO-SAN" },
    { userId: inspD, officeCode: "CEO-SAN" },
    { userId: inspE, officeCode: "BPLO-ILG" },
    { userId: inspE, officeCode: "CAO-ILG" },
  ];
  for (const a of assignDefs) {
    const oId = officeIds[a.officeCode];
    if (!oId) continue;
    await prisma.userOfficeAssignment.upsert({
      where: { userId_officeId: { userId: a.userId, officeId: oId } },
      update: {},
      create: { userId: a.userId, officeId: oId },
    });
  }

  // ── 6. Businesses (20) ─────────────────────────────────────────────────────
  console.log("   Businesses…");
  type BizDef = {
    id: string;
    businessName: string;
    tradeName?: string;
    ownerName: string;
    addressLine: string;
    barangay: string;
    city: string;
    province: string;
    contactNumber?: string;
    taxIdentificationNumber?: string;
    lineOfBusiness: string;
  };
  const bizDefs: BizDef[] = [
    // TUG businesses (1–5)
    {
      id: B1,
      businessName: "North Star Trading",
      tradeName: "North Star",
      ownerName: "Maria Santos",
      addressLine: "12 Rizal St",
      barangay: "Centro 10",
      city: "Tuguegarao City",
      province: "Cagayan",
      contactNumber: "+63 917 555 0101",
      lineOfBusiness: "Retail General Merchandise",
    },
    {
      id: B2,
      businessName: "Cagayan Fresh Market Co.",
      tradeName: "Cagayan Fresh",
      ownerName: "Jose Reyes",
      addressLine: "45 Mabini Ave",
      barangay: "Centro 1",
      city: "Tuguegarao City",
      province: "Cagayan",
      contactNumber: "+63 918 555 0202",
      lineOfBusiness: "Fresh Produce and Wet Market",
    },
    {
      id: B3,
      businessName: "Sunrise Restaurant & Catering",
      tradeName: "Sunrise",
      ownerName: "Celia Ramos",
      addressLine: "88 Burgos St",
      barangay: "Ugac Norte",
      city: "Tuguegarao City",
      province: "Cagayan",
      contactNumber: "+63 919 555 0303",
      lineOfBusiness: "Food and Beverage Service",
    },
    {
      id: B4,
      businessName: "Valley Grocery Store",
      ownerName: "Renato Cruz",
      addressLine: "7 Luna Blvd",
      barangay: "Centro 4",
      city: "Tuguegarao City",
      province: "Cagayan",
      contactNumber: "+63 920 555 0404",
      lineOfBusiness: "Grocery and Convenience Store",
    },
    {
      id: B5,
      businessName: "Cagayan Gas Station Inc.",
      tradeName: "CagGas",
      ownerName: "Florencio De Leon",
      addressLine: "123 Maharlika Hwy",
      barangay: "Caggay",
      city: "Tuguegarao City",
      province: "Cagayan",
      contactNumber: "+63 921 555 0505",
      taxIdentificationNumber: "123-456-789-000",
      lineOfBusiness: "Petroleum Products Retail",
    },
    // CAU businesses (6–9)
    {
      id: B6,
      businessName: "Isabela Hardware Supply",
      tradeName: "IslaHW",
      ownerName: "Ricardo Domingo",
      addressLine: "34 Maharlika Road",
      barangay: "Divisoria",
      city: "Cauayan City",
      province: "Isabela",
      contactNumber: "+63 922 555 0606",
      lineOfBusiness: "Hardware and Construction Supplies",
    },
    {
      id: B7,
      businessName: "Green Fields Farm Supply",
      tradeName: "GreenFields",
      ownerName: "Rosario Galang",
      addressLine: "21 Rizal St",
      barangay: "San Luis",
      city: "Cauayan City",
      province: "Isabela",
      contactNumber: "+63 923 555 0707",
      lineOfBusiness: "Agricultural Supplies and Inputs",
    },
    {
      id: B8,
      businessName: "Highlands Coffee Shop",
      tradeName: "Highlands Café",
      ownerName: "Luisa Bernal",
      addressLine: "5 Quirino St",
      barangay: "Centro",
      city: "Cauayan City",
      province: "Isabela",
      contactNumber: "+63 924 555 0808",
      lineOfBusiness: "Coffee Shop and Snack Bar",
    },
    {
      id: B9,
      businessName: "Isabela Agri-Vet Clinic",
      tradeName: "IVC",
      ownerName: "Dr. Eduardo Tan",
      addressLine: "10 Gen. Aguinaldo",
      barangay: "Sta. Maria",
      city: "Cauayan City",
      province: "Isabela",
      contactNumber: "+63 925 555 0909",
      lineOfBusiness: "Veterinary and Agricultural Services",
    },
    // SAN businesses (10–13)
    {
      id: B10,
      businessName: "Santiago Ice Plant",
      ownerName: "Narciso Paguio",
      addressLine: "88 MacArthur Hwy",
      barangay: "Balintocatoc",
      city: "Santiago City",
      province: "Isabela",
      contactNumber: "+63 926 555 1010",
      lineOfBusiness: "Ice Manufacturing and Cold Storage",
    },
    {
      id: B11,
      businessName: "Cagayan Lumber Yard",
      tradeName: "CagLumber",
      ownerName: "Teofilo Mateo",
      addressLine: "55 Roxas Blvd",
      barangay: "Dubinan West",
      city: "Santiago City",
      province: "Isabela",
      contactNumber: "+63 927 555 1111",
      lineOfBusiness: "Lumber and Building Materials",
    },
    {
      id: B12,
      businessName: "Metro Hotel Santiago",
      tradeName: "Metro Hotel",
      ownerName: "Loreto Aguilar",
      addressLine: "1 National Hwy",
      barangay: "Santiago Centro",
      city: "Santiago City",
      province: "Isabela",
      contactNumber: "+63 928 555 1212",
      taxIdentificationNumber: "234-567-890-000",
      lineOfBusiness: "Hotel and Accommodation",
    },
    {
      id: B13,
      businessName: "Pacific Motor Parts",
      tradeName: "PacMotor",
      ownerName: "Vicente Llanes",
      addressLine: "22 Burgos St",
      barangay: "Cabulay",
      city: "Santiago City",
      province: "Isabela",
      contactNumber: "+63 929 555 1313",
      lineOfBusiness: "Automotive Parts and Accessories",
    },
    // ILG businesses (14–17)
    {
      id: B14,
      businessName: "Northern Bakery & Pastry Shop",
      tradeName: "Northern Bakery",
      ownerName: "Erlinda Soriano",
      addressLine: "3 Rizal Ave",
      barangay: "Poblacion",
      city: "Ilagan City",
      province: "Isabela",
      contactNumber: "+63 930 555 1414",
      lineOfBusiness: "Bakery and Confectionery",
    },
    {
      id: B15,
      businessName: "Cagayan Drug Store",
      tradeName: "CagDrug",
      ownerName: "Pharmacist Elsa Vidal",
      addressLine: "18 Quezon St",
      barangay: "San Andres",
      city: "Ilagan City",
      province: "Isabela",
      contactNumber: "+63 931 555 1515",
      lineOfBusiness: "Pharmacy and Drugstore",
    },
    {
      id: B16,
      businessName: "City Hardware Center Ilagan",
      tradeName: "CityHW Ilagan",
      ownerName: "Gregorio Cabugao",
      addressLine: "40 Mabini St",
      barangay: "Calamagui",
      city: "Ilagan City",
      province: "Isabela",
      contactNumber: "+63 932 555 1616",
      lineOfBusiness: "Hardware and Construction Supplies",
    },
    {
      id: B17,
      businessName: "RiceField Milling Corp.",
      tradeName: "RiceField Mill",
      ownerName: "Artemio Pascual",
      addressLine: "KM 5 Maharlika Hwy",
      barangay: "Sta. Victoria",
      city: "Ilagan City",
      province: "Isabela",
      contactNumber: "+63 933 555 1717",
      taxIdentificationNumber: "345-678-901-000",
      lineOfBusiness: "Rice Milling and Grain Processing",
    },
    // APR businesses (18–20)
    {
      id: B18,
      businessName: "Mountain View Resort Aparri",
      tradeName: "Mountain View",
      ownerName: "Salvador Tagalog",
      addressLine: "Beachfront Rd",
      barangay: "Punta",
      city: "Aparri",
      province: "Cagayan",
      contactNumber: "+63 934 555 1818",
      lineOfBusiness: "Resort and Beach Tourism",
    },
    {
      id: B19,
      businessName: "Aparri Fishport Market",
      tradeName: "Aparri Fishport",
      ownerName: "Catalino Peralta",
      addressLine: "Port Road",
      barangay: "Macanaya",
      city: "Aparri",
      province: "Cagayan",
      contactNumber: "+63 935 555 1919",
      lineOfBusiness: "Seafood and Fish Trade",
    },
    {
      id: B20,
      businessName: "Coastal Seafood Restaurant",
      tradeName: "Coastal Seafood",
      ownerName: "Dominador Lim",
      addressLine: "Riverside Ave",
      barangay: "Punta",
      city: "Aparri",
      province: "Cagayan",
      contactNumber: "+63 936 555 2020",
      lineOfBusiness: "Seafood Restaurant",
    },
  ];

  for (const b of bizDefs) {
    const { lineOfBusiness: _lob, ...bData } = b;
    await prisma.businessEstablishment.upsert({
      where: { id: b.id },
      update: {
        businessName: b.businessName,
        tradeName: b.tradeName,
        ownerName: b.ownerName,
        addressLine: b.addressLine,
        barangay: b.barangay,
        city: b.city,
        province: b.province,
        contactNumber: b.contactNumber,
        taxIdentificationNumber: b.taxIdentificationNumber,
      },
      create: bData,
    });
  }

  // Link business owners
  const ownerLinks: [string, string][] = [
    [ownerA, B1],
    [ownerB, B2],
    [ownerC, B3],
  ];
  for (const [uid, bid] of ownerLinks) {
    await prisma.user.update({ where: { id: uid }, data: { businessId: bid } });
  }

  // ── 7. Permits (20) ────────────────────────────────────────────────────────
  console.log("   Permits…");
  const permitStatuses = [
    "PENDING_INSPECTION",
    "PENDING_INSPECTION",
    "PENDING_INSPECTION",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "DRAFT",
    "PENDING_INSPECTION",
    "APPROVED",
    "APPROVED",
  ] as const;
  const permitDefs = PIDS.map((pid, i) => ({
    id: pid,
    businessId: BIDS[i],
    permitNumber: `FULL-${String(i + 1).padStart(4, "0")}-2026`,
    applicationDate: daysAgo(90 - i * 2),
    expirationDate: daysFrom(275 + i * 5),
    lineOfBusiness: bizDefs[i].lineOfBusiness,
    status: permitStatuses[i],
    createdById: uId("lgu-admin-tug@inspectph.dev"),
  }));
  for (const p of permitDefs) {
    await prisma.permitRecord.upsert({
      where: { id: p.id },
      update: { status: p.status },
      create: p,
    });
  }

  // ── 8. Payments (20) ───────────────────────────────────────────────────────
  console.log("   Payments…");
  const paymentStatuses = [
    "PAID",
    "PAID",
    "PAID",
    "PAID",
    "PAID",
    "PAID",
    "PAID",
    "PAID",
    "PAID",
    "PAID",
    "PENDING",
    "PENDING",
    "PENDING",
    "PENDING",
    "FAILED",
    "FAILED",
    "PROCESSING",
    "REFUNDED",
    "PAID",
    "PAID",
  ] as const;
  for (let i = 0; i < 20; i++) {
    const paidAt = paymentStatuses[i] === "PAID" ? daysAgo(80 - i * 3) : null;
    await prisma.paymentRecord.upsert({
      where: { id: PMIDS[i] },
      update: { status: paymentStatuses[i] },
      create: {
        id: PMIDS[i],
        permitRecordId: PIDS[i],
        referenceNumber: `PAY-FULL-${String(i + 1).padStart(4, "0")}`,
        provider: i % 5 === 0 ? "PAYMONGO" : "LOCAL",
        amountInMinor: (2000 + i * 500) * 100,
        currency: "PHP",
        status: paymentStatuses[i],
        description: `Payment for permit ${permitDefs[i].permitNumber}`,
        paidAt,
        receiptNumber: paidAt
          ? `RCPT-FULL-${String(i + 1).padStart(4, "0")}`
          : null,
      },
    });
  }

  // ── 9. Checklist Templates (20, 2 per module) ─────────────────────────────
  console.log("   Checklist templates…");
  type TmplDef = {
    code: string;
    module: string;
    title: string;
    description: string;
    sort: number;
  };
  const tmplDefs: TmplDef[] = [
    {
      code: "FULL-BPLO-001",
      module: "BPLO",
      sort: 1,
      title: "BPLO General Business Permit Compliance",
      description:
        "Covers signage, business registration, and basic compliance",
    },
    {
      code: "FULL-BPLO-002",
      module: "BPLO",
      sort: 2,
      title: "BPLO Retail Store Inspection",
      description: "Retail-specific business permit and premises inspection",
    },
    {
      code: "FULL-FIRE-001",
      module: "FIRE",
      sort: 1,
      title: "Fire Safety – Commercial Establishment",
      description: "Fire safety for commercial buildings and establishments",
    },
    {
      code: "FULL-FIRE-002",
      module: "FIRE",
      sort: 2,
      title: "Fire Safety – Industrial Facility",
      description:
        "Fire safety inspection for industrial or high-risk facilities",
    },
    {
      code: "FULL-BUILD-001",
      module: "BUILD",
      sort: 1,
      title: "Building Code – Structural Compliance",
      description: "Structural integrity and building code compliance",
    },
    {
      code: "FULL-BUILD-002",
      module: "BUILD",
      sort: 2,
      title: "Building Code – Electrical & Mechanical",
      description: "Electrical and mechanical systems compliance",
    },
    {
      code: "FULL-SANITA-001",
      module: "SANITA",
      sort: 1,
      title: "Sanitation – Food Service Establishment",
      description: "Food handling, storage, and sanitation for food businesses",
    },
    {
      code: "FULL-SANITA-002",
      module: "SANITA",
      sort: 2,
      title: "Sanitation – General Commercial Premises",
      description: "General hygiene and sanitation for non-food businesses",
    },
    {
      code: "FULL-AGRI-001",
      module: "AGRI",
      sort: 1,
      title: "Agricultural Farm Compliance Checklist",
      description:
        "Farm input use, chemical storage, and crop practice compliance",
    },
    {
      code: "FULL-AGRI-002",
      module: "AGRI",
      sort: 2,
      title: "Agri-Supply Store Compliance",
      description: "Fertilizer, pesticide, and feed supply store inspection",
    },
    {
      code: "FULL-MARKET-001",
      module: "MARKET",
      sort: 1,
      title: "Public Market Stall Inspection",
      description: "Vendor stall sanitation, waste, and order compliance",
    },
    {
      code: "FULL-MARKET-002",
      module: "MARKET",
      sort: 2,
      title: "Market Premises & Infrastructure",
      description: "Market facilities, utilities, and structural condition",
    },
    {
      code: "FULL-ECO-001",
      module: "ECOWATCH",
      sort: 1,
      title: "Environmental Waste Compliance",
      description: "Solid waste management and disposal compliance",
    },
    {
      code: "FULL-ECO-002",
      module: "ECOWATCH",
      sort: 2,
      title: "Effluent and Air Quality Compliance",
      description: "Liquid discharge and air emission standards",
    },
    {
      code: "FULL-ZONE-001",
      module: "ZONE",
      sort: 1,
      title: "Zoning – Land Use Compliance",
      description: "Zoning classification and permitted land use verification",
    },
    {
      code: "FULL-ZONE-002",
      module: "ZONE",
      sort: 2,
      title: "Zoning – Setback and Signage",
      description: "Building setback, easement, and signage zone compliance",
    },
    {
      code: "FULL-INFRA-001",
      module: "INFRA",
      sort: 1,
      title: "Infrastructure – Structural Safety",
      description:
        "Roads, bridges, and public infrastructure safety assessment",
    },
    {
      code: "FULL-INFRA-002",
      module: "INFRA",
      sort: 2,
      title: "Infrastructure – Utility Systems",
      description: "Water, power, and drainage infrastructure compliance",
    },
    {
      code: "FULL-TOURISM-001",
      module: "TOURISM",
      sort: 1,
      title: "Tourism – Hotel and Accommodation",
      description: "DOT accreditation checklist for hotels and inns",
    },
    {
      code: "FULL-TOURISM-002",
      module: "TOURISM",
      sort: 2,
      title: "Tourism – Restaurant and Dining Safety",
      description:
        "Food safety and hospitality compliance for dining establishments",
    },
  ];
  const tmplIds: string[] = [];
  for (let i = 0; i < tmplDefs.length; i++) {
    const t = tmplDefs[i];
    const tmpl = await prisma.checklistTemplate.upsert({
      where: { code: t.code },
      update: {
        title: t.title,
        description: t.description,
        sortOrder: t.sort,
        isActive: true,
      },
      create: {
        id: sid(8, i + 1),
        module: t.module,
        code: t.code,
        title: t.title,
        description: t.description,
        sortOrder: t.sort,
        isActive: true,
        version: 1,
        publishedAt: daysAgo(60 - i),
      },
    });
    tmplIds.push(tmpl.id);
  }

  // ── 10. Inspections (20) ───────────────────────────────────────────────────
  console.log("   Inspections…");
  // [bizId, moduleCode, officeCode, inspectorId|null, status, scheduledDaysOffset]
  type InspRow = [string, string, string, string | null, string, number];
  const inspRows: InspRow[] = [
    [B1, "BPLO", "BPLO-TUG", inspA, "SCHEDULED", 3],
    [B2, "FIRE", "BFP-TUG", inspA, "COMPLETED", -30],
    [B3, "BUILD", "OBO-TUG", inspB, "IN_PROGRESS", -5],
    [B4, "SANITA", "CHO-TUG", inspB, "OVERDUE", -20],
    [B5, "BPLO", "BPLO-CAU", inspC, "COMPLETED", -45],
    [B6, "AGRI", "MAO-CAU", inspC, "SCHEDULED", 7],
    [B7, "ECOWATCH", "ENRO-CAU", null, "IN_PROGRESS", -3],
    [B8, "MARKET", "PMO-CAU", null, "OVERDUE", -15],
    [B9, "BPLO", "BPLO-SAN", inspD, "SCHEDULED", 5],
    [B10, "FIRE", "BFP-SAN", null, "COMPLETED", -60],
    [B11, "BUILD", "CEO-SAN", inspD, "IN_PROGRESS", -8],
    [B12, "TOURISM", "CTO-SAN", null, "OVERDUE", -25],
    [B13, "BPLO", "BPLO-ILG", inspE, "SCHEDULED", 10],
    [B14, "AGRI", "CAO-ILG", inspE, "COMPLETED", -40],
    [B15, "ECOWATCH", "CENRO-ILG", null, "IN_PROGRESS", -12],
    [B16, "INFRA", "CIO-ILG", null, "CANCELED", -50],
    [B17, "BPLO", "BPLO-APR", null, "SCHEDULED", 14],
    [B18, "FIRE", "FS-APR", null, "COMPLETED", -70],
    [B19, "AGRI", "MAO-APR", null, "COMPLETED", -55],
    [B20, "TOURISM", "TLO-APR", null, "SCHEDULED", 21],
  ];

  for (let i = 0; i < inspRows.length; i++) {
    const [bizId, modCode, offCode, inspId, status, dayOff] = inspRows[i];
    const offId = officeIds[offCode];
    const scheduledAt = dayOff >= 0 ? daysFrom(dayOff) : daysAgo(-dayOff);
    const startedAt = ["IN_PROGRESS", "COMPLETED"].includes(status)
      ? new Date(scheduledAt.getTime() + 3_600_000)
      : undefined;
    const completedAt =
      status === "COMPLETED"
        ? new Date(scheduledAt.getTime() + 7_200_000)
        : undefined;

    await prisma.inspection.upsert({
      where: { id: IIDS[i] },
      update: { status: status as never, inspectorId: inspId },
      create: {
        id: IIDS[i],
        businessId: bizId,
        permitRecordId: PIDS[i],
        officeId: offId,
        inspectorId: inspId,
        moduleCode: modCode,
        scheduledAt,
        startedAt,
        completedAt,
        status: status as never,
        notes: `Full seed – ${modCode} inspection for ${bizDefs[i].businessName}`,
        locationLatitude: 17.613 + i * 0.01,
        locationLongitude: 121.727 + i * 0.01,
        locationAccuracyMeters: 5 + (i % 8),
      },
    });
  }

  // ── 11. Checklist Results (20) ─────────────────────────────────────────────
  console.log("   Checklist results…");
  // Pair (inspectionIndex, templateIndex, status)
  // Only for started/completed inspections (indices 1,2,3,4,6,7,9,10,13,14)
  const resultRows: [number, number, string][] = [
    [1, 2, "PASS"], // I2  FIRE completed → FULL-FIRE-001
    [1, 3, "FAIL"], // I2  FIRE completed → FULL-FIRE-002
    [2, 4, "PASS"], // I3  BUILD in_progress → FULL-BUILD-001
    [2, 5, "NOT_APPLICABLE"], // I3 → FULL-BUILD-002
    [3, 6, "FAIL"], // I4  SANITA overdue → FULL-SANITA-001
    [4, 0, "PASS"], // I5  BPLO completed → FULL-BPLO-001
    [4, 1, "PASS"], // I5  BPLO completed → FULL-BPLO-002
    [6, 12, "PASS"], // I7  ECO in_progress → FULL-ECO-001
    [6, 13, "FAIL"], // I7  ECO in_progress → FULL-ECO-002
    [7, 10, "FAIL"], // I8  MARKET overdue → FULL-MARKET-001
    [9, 2, "PASS"], // I10 FIRE completed → FULL-FIRE-001
    [9, 3, "PASS"], // I10 FIRE completed → FULL-FIRE-002
    [10, 4, "FAIL"], // I11 BUILD in_progress → FULL-BUILD-001
    [11, 18, "PASS"], // I12 TOURISM overdue → FULL-TOURISM-001
    [13, 8, "PASS"], // I14 AGRI completed → FULL-AGRI-001
    [13, 9, "PASS"], // I14 AGRI completed → FULL-AGRI-002
    [14, 12, "FAIL"], // I15 ECO in_progress → FULL-ECO-001
    [17, 2, "PASS"], // I18 FIRE completed → FULL-FIRE-001
    [18, 8, "PASS"], // I19 AGRI completed → FULL-AGRI-001
    [18, 9, "NOT_APPLICABLE"], // I19 → FULL-AGRI-002
  ];

  const resultIds: string[] = [];
  for (let r = 0; r < resultRows.length; r++) {
    const [ii, ti, status] = resultRows[r];
    const resultId = sid(9, r + 1);
    await prisma.inspectionChecklistResult.upsert({
      where: { id: resultId },
      update: { status: status as never },
      create: {
        id: resultId,
        inspectionId: IIDS[ii],
        templateId: tmplIds[ti],
        status: status as never,
        templateVersion: 1,
        remarks:
          status === "FAIL"
            ? "Non-compliant item identified during inspection"
            : null,
      },
    });
    resultIds.push(resultId);
  }

  // ── 12. Findings (20) ─────────────────────────────────────────────────────
  console.log("   Findings…");
  const sevs = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  type FindRow = {
    inspIdx: number;
    resultIdx: number | null;
    title: string;
    desc: string;
    sev: (typeof sevs)[number];
    daysDue: number | null;
  };
  const findRows: FindRow[] = [
    // I2 FIRE completed (result rows 0,1)
    {
      inspIdx: 1,
      resultIdx: 1,
      title: "Missing fire extinguisher",
      desc: "3 of 5 required fire extinguishers absent from designated posts",
      sev: "HIGH",
      daysDue: 14,
    },
    {
      inspIdx: 1,
      resultIdx: 1,
      title: "Blocked fire exit",
      desc: "Storage boxes blocking emergency exit B",
      sev: "CRITICAL",
      daysDue: 3,
    },
    {
      inspIdx: 1,
      resultIdx: 0,
      title: "Expired sprinkler maintenance record",
      desc: "Last inspection certificate expired 6 months ago",
      sev: "MEDIUM",
      daysDue: 30,
    },
    // I3 BUILD in_progress (result rows 2,3)
    {
      inspIdx: 2,
      resultIdx: 2,
      title: "Inadequate rebar spacing on 2F slab",
      desc: "Rebar spacing 250mm vs required 150mm in several sections",
      sev: "HIGH",
      daysDue: 21,
    },
    {
      inspIdx: 2,
      resultIdx: 3,
      title: "No as-built plan displayed on site",
      desc: "Approved building plan not posted at visible location",
      sev: "LOW",
      daysDue: 7,
    },
    // I4 SANITA overdue (result row 4)
    {
      inspIdx: 3,
      resultIdx: 4,
      title: "Pest infestation in food storage area",
      desc: "Evidence of rodent activity near dry storage; traps absent",
      sev: "CRITICAL",
      daysDue: 3,
    },
    {
      inspIdx: 3,
      resultIdx: 4,
      title: "No handwashing station at food prep area",
      desc: "Handwashing facility not present at required workstation",
      sev: "HIGH",
      daysDue: 7,
    },
    // I5 BPLO completed (result rows 5,6)
    {
      inspIdx: 4,
      resultIdx: 5,
      title: "Expired occupancy permit displayed",
      desc: "Occupancy permit posted is from 2024, renewal not processed",
      sev: "MEDIUM",
      daysDue: 30,
    },
    {
      inspIdx: 4,
      resultIdx: 6,
      title: "Business name on signage does not match DTI",
      desc: "Trade name on facade differs from registered DTI name",
      sev: "LOW",
      daysDue: 30,
    },
    // I7 ECO in_progress (result rows 7,8)
    {
      inspIdx: 6,
      resultIdx: 8,
      title: "Uncovered waste containers outdoors",
      desc: "Open garbage bins near drainage; risk of water contamination",
      sev: "MEDIUM",
      daysDue: 7,
    },
    {
      inspIdx: 6,
      resultIdx: 8,
      title: "No effluent disposal records on file",
      desc: "Company cannot present last 3 months of effluent discharge logs",
      sev: "HIGH",
      daysDue: 14,
    },
    // I10 FIRE completed (result rows 10,11)
    {
      inspIdx: 9,
      resultIdx: 10,
      title: "Fire alarm panel inoperative",
      desc: "Main fire alarm control panel shows fault on zones 2 and 4",
      sev: "CRITICAL",
      daysDue: 5,
    },
    {
      inspIdx: 9,
      resultIdx: 10,
      title: "Emergency lighting insufficient",
      desc: "Emergency lights cover only 60% of required exit paths",
      sev: "HIGH",
      daysDue: 14,
    },
    {
      inspIdx: 9,
      resultIdx: 11,
      title: "Fire hose cabinet locked without key",
      desc: "2 of 3 fire hose cabinets padlocked; no key available on-site",
      sev: "HIGH",
      daysDue: 7,
    },
    // I11 BUILD in_progress (result row 12)
    {
      inspIdx: 10,
      resultIdx: 12,
      title: "Unsecured scaffolding on east facade",
      desc: "Scaffolding pipes not cross-braced; workers without harness observed",
      sev: "CRITICAL",
      daysDue: 1,
    },
    {
      inspIdx: 10,
      resultIdx: 12,
      title: "Masonry wall cracks on ground floor",
      desc: "Diagonal cracks ~3mm width on load-bearing wall in east wing",
      sev: "HIGH",
      daysDue: 10,
    },
    // I14 AGRI completed (result rows 14,15)
    {
      inspIdx: 13,
      resultIdx: 14,
      title: "Unlabeled pesticide containers",
      desc: "15 pesticide containers have no label or SDS on shelf",
      sev: "HIGH",
      daysDue: 7,
    },
    {
      inspIdx: 13,
      resultIdx: 14,
      title: "Missing fertilizer purchase records",
      desc: "No purchase receipts for fertilizer stock from last quarter",
      sev: "LOW",
      daysDue: 30,
    },
    // I15 ECO in_progress (result row 16)
    {
      inspIdx: 14,
      resultIdx: 16,
      title: "Industrial effluent exceeds BOD limit",
      desc: "BOD test shows 80mg/L vs regulatory limit of 50mg/L",
      sev: "CRITICAL",
      daysDue: 7,
    },
    // I18 FIRE completed (result row 17)
    {
      inspIdx: 17,
      resultIdx: 17,
      title: "No fire safety plan posted",
      desc: "Evacuation plan and fire drill records not available on premises",
      sev: "MEDIUM",
      daysDue: 14,
    },
  ];

  const findingIds: string[] = [];
  for (let f = 0; f < findRows.length; f++) {
    const fr = findRows[f];
    const fid = sid(10, f + 1);
    const rId = fr.resultIdx !== null ? resultIds[fr.resultIdx] : null;
    await prisma.finding.upsert({
      where: { id: fid },
      update: { title: fr.title, severity: fr.sev as never },
      create: {
        id: fid,
        inspectionId: IIDS[fr.inspIdx],
        checklistResultId: rId,
        severity: fr.sev as never,
        title: fr.title,
        description: fr.desc,
        correctiveAction: `Immediately address: ${fr.title.toLowerCase()}`,
        dueDate: fr.daysDue !== null ? daysFrom(fr.daysDue) : null,
      },
    });
    findingIds.push(fid);
  }

  // ── 13. Corrective Action Plans (15) ──────────────────────────────────────
  console.log("   CAPs…");
  // CAPs for findings 0–14 (HIGH and CRITICAL ones)
  const capRows: [number, string, number][] = [
    [0, "OPEN", 14],
    [1, "OPEN", 3],
    [2, "ACKNOWLEDGED", 30],
    [3, "OPEN", 21],
    [5, "ESCALATED", 3],
    [6, "OPEN", 7],
    [7, "ACKNOWLEDGED", 30],
    [9, "OPEN", 7],
    [10, "OPEN", 14],
    [11, "OPEN", 5],
    [12, "OPEN", 14],
    [13, "ACKNOWLEDGED", 7],
    [14, "OPEN", 1],
    [15, "OPEN", 10],
    [16, "OPEN", 7],
  ];
  for (let c = 0; c < capRows.length; c++) {
    const [fIdx, capStatus, dueInDays] = capRows[c];
    const fid = findingIds[fIdx];
    const inspIdx = findRows[fIdx].inspIdx;
    const bizId = BIDS[inspIdx];
    await prisma.correctiveActionPlan.upsert({
      where: { findingId: fid },
      update: { status: capStatus as never },
      create: {
        id: sid(11, c + 1),
        findingId: fid,
        inspectionId: IIDS[inspIdx],
        businessId: bizId,
        description: `Corrective action required: ${findRows[fIdx].title}. Establishment must provide written resolution with supporting documentation.`,
        deadlineAt: daysFrom(dueInDays),
        status: capStatus as never,
      },
    });
  }

  // ── 14. Fire Safety Certificates (5) ──────────────────────────────────────
  console.log("   Fire safety certificates…");
  // Completed FIRE inspections: I2(idx1), I10(idx9), I18(idx17)
  const fireCertRows: [number, string][] = [
    [1, "ISSUED"],
    [9, "ISSUED"],
    [17, "ISSUED"],
  ];
  for (let fc = 0; fc < fireCertRows.length; fc++) {
    const [ii, certStatus] = fireCertRows[fc];
    const issuedAt = completedAtOf(ii);
    await prisma.fireSafetyCertificate.upsert({
      where: { inspectionId: IIDS[ii] },
      update: { status: certStatus as never },
      create: {
        id: sid(12, fc + 1),
        inspectionId: IIDS[ii],
        certificateNumber: `FSC-FULL-${String(fc + 1).padStart(4, "0")}-2026`,
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 365 * 24 * 3_600_000),
        status: certStatus as never,
        remarks:
          "Fire safety inspection passed. Certificate valid for one year.",
        verificationUrl: `https://inspect.ph/verify/FSC-FULL-${String(fc + 1).padStart(4, "0")}-2026`,
      },
    });
  }

  // ── 15. Issue Reports (20) ────────────────────────────────────────────────
  console.log("   Issue reports…");
  const irCats = [
    "FIRE_HAZARD",
    "SANITATION",
    "STRUCTURAL",
    "PUBLIC_SAFETY",
    "OTHER",
  ] as const;
  const irStatuses = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "RESOLVED",
    "DISMISSED",
  ] as const;
  const irSubjects = [
    "Smoke coming from old factory building",
    "Overflowing drainage in public market",
    "Crumbling concrete wall at multi-storey parking",
    "Uncollected garbage on Rizal Street for 5 days",
    "Unlicensed food stall serving near school",
    "Damaged fire hydrant at corner Mabini-Burgos",
    "Restaurant disposing grease into street drainage",
    "Abandoned building with exposed rebar accessible to children",
    "Pesticide smell near residential area from farm spray",
    "Overcrowded hardware store blocking sidewalk",
    "Open electrical wiring at public wet market",
    "Food vendor without health certificate near hospital",
    "Large crack on bridge abutment along Maharlika Hwy",
    "Burning garbage inside residential compound",
    "Market stall flooding during rain due to clogged drain",
    "Building under construction without fence or safety net",
    "Dead animals in creek near public water source",
    "Resort without posted fire evacuation plan",
    "Unlicensed chemical storage behind commercial bldg",
    "Noise and smoke from informal milling operation at night",
  ];
  const irReporterUsers = [
    citizA,
    citizB,
    null,
    citizA,
    null,
    citizB,
    null,
    citizA,
    null,
    citizB,
    citizA,
    null,
    citizB,
    null,
    citizA,
    null,
    citizB,
    null,
    citizA,
    null,
  ];
  for (let r = 0; r < 20; r++) {
    await prisma.issueReport.upsert({
      where: { id: IRIDS[r] },
      update: { status: irStatuses[r % 4] as never },
      create: {
        id: IRIDS[r],
        reportNumber: `IR-FULL-${String(r + 1).padStart(4, "0")}-2026`,
        reporterUserId: irReporterUsers[r],
        category: irCats[r % 5],
        subject: irSubjects[r],
        description: `Concerned citizen reports: ${irSubjects[r]}. Please investigate and take appropriate action.`,
        locationDescription: `${bizDefs[r % 20].barangay}, ${bizDefs[r % 20].city}`,
        reporterName: irReporterUsers[r] ? undefined : "Anonymous Reporter",
        reporterEmail: irReporterUsers[r] ? undefined : `anon-${r}@example.com`,
        reporterPhone: irReporterUsers[r] ? undefined : "+63 900 555 0000",
        locationLatitude: 17.61 + r * 0.003,
        locationLongitude: 121.73 + r * 0.003,
        status: irStatuses[r % 4] as never,
      },
    });
  }

  // ── 16. Attachments (20) ──────────────────────────────────────────────────
  console.log("   Attachments…");
  const mimeTypes = ["image/jpeg", "image/png", "application/pdf"];
  for (let a = 0; a < 20; a++) {
    const ii = a % 10; // spread across 10 inspections
    const fIdx = a < 10 ? null : (findingIds[a - 10] ?? null);
    const mime = mimeTypes[a % 3];
    await prisma.attachment.upsert({
      where: { id: ATIDS[a] },
      update: {},
      create: {
        id: ATIDS[a],
        inspectionId: IIDS[ii],
        findingId: fIdx,
        fileName: `${mime.includes("pdf") ? "report" : "photo"}-${a + 1}.${mime.split("/")[1]}`,
        mimeType: mime,
        fileSizeBytes: 100_000 + a * 25_000,
        storageKey: `full-seed/inspections/${IIDS[ii]}/attachment-${a + 1}`,
        capturedAt: daysAgo(a % 30),
        locationLatitude: 17.613 + ii * 0.01,
        locationLongitude: 121.727 + ii * 0.01,
        locationAccuracyMeters: 5,
      },
    });
  }

  // ── 17. Audit Logs (20) ───────────────────────────────────────────────────
  console.log("   Audit logs…");
  const auditActions = [
    [
      "CREATE",
      "Inspection",
      "Created inspection FULL-0001 for North Star Trading",
    ],
    ["UPDATE", "Inspection", "Updated inspection status to COMPLETED"],
    [
      "CREATE",
      "PermitRecord",
      "Created permit FULL-0001-2026 for North Star Trading",
    ],
    [
      "UPDATE",
      "PermitRecord",
      "Permit status changed from PENDING_INSPECTION to APPROVED",
    ],
    ["CREATE", "User", "New inspector account created: insp-a@inspectph.dev"],
    ["UPDATE", "User", "Inspector office assignment updated"],
    ["CREATE", "Finding", "New HIGH finding logged during FIRE inspection"],
    [
      "CREATE",
      "CorrectiveActionPlan",
      "CAP created for finding: Missing fire extinguisher",
    ],
    ["UPDATE", "CorrectiveActionPlan", "CAP status changed to ACKNOWLEDGED"],
    [
      "CREATE",
      "FireSafetyCertificate",
      "FSC-FULL-0001-2026 issued for BFP-TUG inspection",
    ],
    [
      "CREATE",
      "IssueReport",
      "Issue report IR-FULL-0001-2026 submitted by citizen",
    ],
    ["UPDATE", "IssueReport", "Issue report moved to UNDER_REVIEW"],
    ["CREATE", "PaymentRecord", "Payment initiated for permit FULL-0005-2026"],
    ["UPDATE", "PaymentRecord", "Payment PAID for permit FULL-0005-2026"],
    ["LOGIN", "User", "Inspector insp-b@inspectph.dev logged in from mobile"],
    ["LOGOUT", "User", "Inspector insp-b@inspectph.dev logged out"],
    [
      "CREATE",
      "Attachment",
      "Photo attachment uploaded for inspection finding",
    ],
    [
      "UPDATE",
      "Inspection",
      "Inspection geo-location captured during field visit",
    ],
    ["CREATE", "ChecklistTemplate", "New template FULL-BPLO-001 published"],
    ["UPDATE", "Inspection", "Inspection notes updated after field completion"],
  ];
  const auditActors = [
    U13,
    U14,
    U2,
    U2,
    U1,
    U1,
    U13,
    U13,
    U7,
    U8,
    null,
    U7,
    U10,
    U10,
    U14,
    U14,
    U13,
    U13,
    U1,
    U14,
  ];
  const auditActorRoles = [
    "INSPECTOR",
    "INSPECTOR",
    "LGU_ADMIN",
    "LGU_ADMIN",
    "ADMIN",
    "ADMIN",
    "INSPECTOR",
    "INSPECTOR",
    "OFFICE_SUPERVISOR",
    "OFFICE_SUPERVISOR",
    null,
    "OFFICE_SUPERVISOR",
    "OFFICE_CLERK",
    "OFFICE_CLERK",
    "INSPECTOR",
    "INSPECTOR",
    "INSPECTOR",
    "INSPECTOR",
    "ADMIN",
    "INSPECTOR",
  ];
  for (let a = 0; a < 20; a++) {
    const [action, entityType, summary] = auditActions[a];
    await prisma.auditLog.upsert({
      where: { id: ALIDS[a] },
      update: {},
      create: {
        id: ALIDS[a],
        actorUserId: auditActors[a] ?? null,
        actorRole: (auditActorRoles[a] as never) ?? null,
        action,
        entityType,
        entityId: IIDS[a % 10],
        summary,
        detail: `Full seed audit entry ${a + 1}`,
        createdAt: daysAgo(20 - a),
      },
    });
  }

  // ── 18. Notification Outbox (20) ──────────────────────────────────────────
  console.log("   Notifications…");
  const notifEvents = [
    [
      "INSPECTION_ASSIGNED",
      "New Inspection Assigned",
      "You have been assigned to inspect North Star Trading on May 22",
    ],
    [
      "INSPECTION_COMPLETED",
      "Inspection Completed",
      "FIRE inspection for Cagayan Fresh Market has been completed",
    ],
    [
      "FINDING_CREATED",
      "New Finding Logged",
      "A CRITICAL fire safety finding was recorded during your inspection",
    ],
    [
      "CAP_CREATED",
      "Corrective Action Plan Created",
      "A CAP has been issued for your establishment. Deadline: 3 days",
    ],
    [
      "PERMIT_APPROVED",
      "Permit Application Approved",
      "Your business permit FULL-0001-2026 has been approved",
    ],
    [
      "PAYMENT_RECEIVED",
      "Payment Confirmed",
      "Payment for permit FULL-0005-2026 has been confirmed",
    ],
    [
      "ISSUE_REPORT_UPDATE",
      "Issue Report Update",
      "Your report IR-FULL-0001-2026 is now under review",
    ],
    [
      "INSPECTION_OVERDUE",
      "Inspection Overdue Alert",
      "Inspection for Valley Grocery Store is now overdue",
    ],
    [
      "CAP_DUE_SOON",
      "CAP Deadline Approaching",
      "Corrective action for blocked fire exit is due in 2 days",
    ],
    [
      "CERTIFICATE_ISSUED",
      "Fire Safety Certificate Issued",
      "FSC-FULL-0001-2026 has been issued and is valid for one year",
    ],
    [
      "INSPECTION_ASSIGNED",
      "New Inspection Assigned",
      "You have been assigned to inspect Sunrise Restaurant",
    ],
    [
      "FINDING_CREATED",
      "New Finding Logged",
      "A HIGH structural finding was recorded during building inspection",
    ],
    [
      "CAP_ESCALATED",
      "CAP Escalated",
      "CAP for pest infestation in food storage has been escalated",
    ],
    [
      "PERMIT_APPROVED",
      "Permit Approved",
      "Your permit FULL-0006-2026 has been approved",
    ],
    [
      "INSPECTION_COMPLETED",
      "Inspection Completed",
      "AGRI inspection for Isabela Agri-Vet Clinic completed",
    ],
    [
      "ISSUE_REPORT_RESOLVED",
      "Issue Report Resolved",
      "Your report about smoke from factory has been resolved",
    ],
    [
      "PAYMENT_FAILED",
      "Payment Failed",
      "Payment for permit FULL-0015-2026 failed. Please try again",
    ],
    [
      "INSPECTION_ASSIGNED",
      "New Inspection Assigned",
      "You are assigned to inspect Green Fields Farm Supply on May 26",
    ],
    [
      "CAP_ACKNOWLEDGED",
      "CAP Acknowledged",
      "Your corrective action plan has been acknowledged by inspector",
    ],
    [
      "FINDING_RESOLVED",
      "Finding Resolved",
      "Finding: Expired occupancy permit has been marked as resolved",
    ],
  ];
  const notifRecipients = [
    U13,
    U13,
    U13,
    U18,
    U18,
    U18,
    U21,
    U7,
    U18,
    U13,
    U14,
    U14,
    U18,
    U19,
    U15,
    U21,
    U20,
    U15,
    U19,
    U18,
  ];
  const notifStatuses = [
    "PROCESSED",
    "PROCESSED",
    "PROCESSED",
    "PENDING",
    "PROCESSED",
    "PROCESSED",
    "PENDING",
    "PROCESSED",
    "PENDING",
    "PROCESSED",
    "PROCESSED",
    "PENDING",
    "PENDING",
    "PROCESSED",
    "PROCESSED",
    "PROCESSED",
    "FAILED",
    "PENDING",
    "PROCESSED",
    "PENDING",
  ] as const;
  for (let n = 0; n < 20; n++) {
    const [eventType, title, body] = notifEvents[n];
    await prisma.notificationOutbox.upsert({
      where: { id: NIDS[n] },
      update: {},
      create: {
        id: NIDS[n],
        recipientUserId: notifRecipients[n],
        channel: n % 3 === 0 ? "PUSH" : "IN_APP",
        eventType,
        title,
        body,
        entityType: "Inspection",
        entityId: IIDS[n % 10],
        status: notifStatuses[n],
        processedAt: notifStatuses[n] === "PROCESSED" ? daysAgo(n % 5) : null,
        createdAt: daysAgo(20 - n),
      },
    });
  }

  // ── 19. Data Subject Requests (10) ────────────────────────────────────────
  console.log("   Data subject requests…");
  const dsrTypes = ["ACCESS", "CORRECTION", "ERASURE"] as const;
  const dsrStatuses = [
    "PENDING",
    "IN_REVIEW",
    "COMPLETED",
    "REJECTED",
    "WITHDRAWN",
  ] as const;
  for (let d = 0; d < 10; d++) {
    await prisma.dataSubjectRequest.upsert({
      where: { id: DSRIDS[d] },
      update: {},
      create: {
        id: DSRIDS[d],
        type: dsrTypes[d % 3],
        status: dsrStatuses[d % 5] as never,
        requestedByUserId: d % 2 === 0 ? citizA : citizB,
        email:
          d % 2 === 0 ? "citizen-a@inspectph.dev" : "citizen-b@inspectph.dev",
        description: `${dsrTypes[d % 3] === "ACCESS" ? "Request for a copy of all personal data held by the system" : dsrTypes[d % 3] === "CORRECTION" ? "Request to update incorrect contact details in the system" : "Request to permanently delete personal data from the system"} — DSR ${d + 1}`,
        response:
          dsrStatuses[d % 5] === "COMPLETED"
            ? "Request fulfilled. Data provided per DPA guidelines."
            : null,
        completedAt: dsrStatuses[d % 5] === "COMPLETED" ? daysAgo(d) : null,
      },
    });
  }

  // ── 20. Finding Disputes (10) ─────────────────────────────────────────────
  console.log("   Finding disputes…");
  const disputeStatuses = [
    "PENDING",
    "REVIEWING",
    "UPHELD",
    "OVERTURNED",
  ] as const;
  for (let d = 0; d < 10; d++) {
    const fid = findingIds[d];
    if (!fid) continue;
    const existing = await prisma.findingDispute.findUnique({
      where: { findingId: fid },
    });
    if (!existing) {
      await prisma.findingDispute.create({
        data: {
          id: sid(19, d + 1),
          findingId: fid,
          disputedByUserId: ownerA,
          reason: `We dispute finding "${findRows[d].title}". The condition was already rectified prior to inspection and photographic evidence was not properly reviewed.`,
          status: disputeStatuses[d % 4] as never,
          resolution: ["UPHELD", "OVERTURNED"].includes(disputeStatuses[d % 4])
            ? "Dispute reviewed by supervisor. Determination made based on submitted evidence."
            : null,
          resolvedAt: ["UPHELD", "OVERTURNED"].includes(disputeStatuses[d % 4])
            ? daysAgo(d)
            : null,
          resolvedByUserId: ["UPHELD", "OVERTURNED"].includes(
            disputeStatuses[d % 4],
          )
            ? supTug
            : null,
        },
      });
    }
  }

  // ── 21. Payment Anomaly Flags (5) ─────────────────────────────────────────
  console.log("   Payment anomaly flags…");
  for (let f = 0; f < 5; f++) {
    await prisma.paymentAnomalyFlag.upsert({
      where: { id: sid(20, f + 1) },
      update: {},
      create: {
        id: sid(20, f + 1),
        paymentId: PMIDS[f + 14], // payments 15–19 (FAILED / edge cases)
        reason: [
          "DUPLICATE",
          "AMOUNT_MISMATCH",
          "LOW_AMOUNT",
          "HIGH_VELOCITY",
          "DUPLICATE",
        ][f],
        detail: `Anomaly detected during payment processing — flag ${f + 1}`,
        quarantinedAt: daysAgo(f + 1),
        resolvedAt: f < 2 ? daysAgo(f) : null,
        resolvedById: f < 2 ? uId("admin-full@inspectph.dev") : null,
      },
    });
  }

  // ── 22. Webhook Endpoints (5) ─────────────────────────────────────────────
  console.log("   Webhook endpoints…");
  const wlguIds = [tug, cau, san, ilg, apr];
  const whIds: string[] = [];
  for (let w = 0; w < 5; w++) {
    const wId = sid(25, w + 1);
    whIds.push(wId);
    await prisma.lguWebhookEndpoint.upsert({
      where: { id: wId },
      update: {},
      create: {
        id: wId,
        lguId: wlguIds[w],
        url: `https://lgu-${["tug", "cau", "san", "ilg", "apr"][w]}.example.gov.ph/webhooks/inspect`,
        secret: `wh-secret-full-${w + 1}-replace-in-production`,
        events: [
          "inspection.completed",
          "permit.approved",
          "payment.paid",
          "finding.created",
        ],
        isActive: true,
      },
    });
  }

  // ── 23. Webhook Deliveries (10) ───────────────────────────────────────────
  console.log("   Webhook deliveries…");
  for (let d = 0; d < 10; d++) {
    const wId = whIds[d % 5];
    const success = d % 3 !== 0;
    await prisma.webhookDelivery.upsert({
      where: { id: sid(26, d + 1) },
      update: {},
      create: {
        id: sid(26, d + 1),
        endpointId: wId,
        event: [
          "inspection.completed",
          "permit.approved",
          "payment.paid",
          "finding.created",
        ][d % 4],
        payload: {
          event: "inspection.completed",
          data: { inspectionId: IIDS[d % 10], status: "COMPLETED" },
        },
        statusCode: success ? 200 : 503,
        attempt: d < 5 ? 1 : 2,
        success,
        sentAt: daysAgo(d),
        nextRetryAt: success ? null : daysFrom(1),
      },
    });
  }

  // ── 24. OAuth Clients (3) ─────────────────────────────────────────────────
  console.log("   OAuth clients…");
  const oauthClients = [
    {
      id: sid(21, 1),
      clientId: "inspect-ph-dashboard-full",
      name: "Inspect PH Dashboard (Full Seed)",
      redirectUri: "http://localhost:3000/auth/callback",
      scopes: ["read:inspections", "write:inspections", "read:permits"],
    },
    {
      id: sid(21, 2),
      clientId: "inspect-ph-mobile-full",
      name: "Inspect PH Mobile App (Full Seed)",
      redirectUri: "inspectph://auth/callback",
      scopes: ["read:inspections", "write:findings", "read:checklists"],
    },
    {
      id: sid(21, 3),
      clientId: "inspect-ph-partner-api",
      name: "Partner API Integration",
      redirectUri: "https://partner.example.com/oauth/cb",
      scopes: ["read:inspections", "read:permits"],
    },
  ];
  for (const oc of oauthClients) {
    await prisma.oAuthClient.upsert({
      where: { clientId: oc.clientId },
      update: { name: oc.name },
      create: {
        id: oc.id,
        clientId: oc.clientId,
        clientSecret: await hashPassword(`client-secret-${oc.clientId}`),
        name: oc.name,
        description: `OAuth2 client for ${oc.name}`,
        redirectUri: oc.redirectUri,
        scopes: oc.scopes,
        isActive: true,
      },
    });
  }

  // ── 25. Checklist Template Ratings (10) ───────────────────────────────────
  console.log("   Checklist template ratings…");
  // Different LGUs rating shared templates
  const ratingLguIds = [tug, cau, san, ilg, apr, tug, cau, san, ilg, apr];
  const ratingTmplIdxs = [0, 2, 4, 8, 10, 12, 14, 16, 18, 19];
  const ratings = [5, 4, 5, 4, 3, 4, 5, 3, 4, 5];
  const ratingComments = [
    "Excellent template, very comprehensive for BPLO compliance",
    "Good fire safety checklist, covers all BFP requirements",
    "Clear building code checklist, easy to use in the field",
    "Thorough agricultural checklist covering all required items",
    "Decent market checklist but could use more vendor-specific items",
    "Solid environmental checklist, aligns with DENR requirements",
    "Zoning checklist is well-structured and easy to follow",
    "Infrastructure checklist needs updating for 2026 code standards",
    "Very good tourism accreditation template",
    "Comprehensive restaurant safety template, highly recommended",
  ];
  for (let r = 0; r < 10; r++) {
    const tId = tmplIds[ratingTmplIdxs[r]];
    const lId = ratingLguIds[r];
    await prisma.checklistTemplateRating.upsert({
      where: { templateId_lguId: { templateId: tId, lguId: lId } },
      update: { rating: ratings[r], comment: ratingComments[r] },
      create: {
        id: sid(24, r + 1),
        templateId: tId,
        lguId: lId,
        rating: ratings[r],
        comment: ratingComments[r],
      },
    });
  }

  // ── 26. Cross-LGU Recognition Requests (10) ───────────────────────────────
  console.log("   Cross-LGU recognition requests…");
  const recogStatuses = [
    "PENDING_CONSENT",
    "CONSENT_GRANTED",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
  ] as const;
  const recogPairs: [string, string][] = [
    [tug, cau],
    [cau, san],
    [san, ilg],
    [ilg, apr],
    [apr, tug],
    [tug, san],
    [cau, ilg],
    [san, apr],
    [ilg, tug],
    [apr, cau],
  ];
  for (let r = 0; r < 10; r++) {
    const [reqLgu, issLgu] = recogPairs[r];
    await prisma.crossLguRecognitionRequest.upsert({
      where: { id: sid(22, r + 1) },
      update: {},
      create: {
        id: sid(22, r + 1),
        requestingLguId: reqLgu,
        issuingLguId: issLgu,
        certificateNumber: `FSC-RECOG-${String(r + 1).padStart(4, "0")}-2026`,
        businessName: bizDefs[r * 2].businessName,
        status: recogStatuses[r % 5] as never,
        requestedByUserId: uId("admin-full@inspectph.dev"),
        complianceScore: 70 + r * 3,
        complianceGrade: ["A", "B", "A", "C", "B", "A", "A", "B", "A", "B"][r],
        expiresAt: daysFrom(180 + r * 10),
        consentGivenAt:
          recogStatuses[r % 5] !== "PENDING_CONSENT" ? daysAgo(r + 1) : null,
        resolvedAt: ["APPROVED", "REJECTED", "EXPIRED"].includes(
          recogStatuses[r % 5],
        )
          ? daysAgo(r)
          : null,
      },
    });
  }

  // ── 27. National Verification Records (10) ────────────────────────────────
  console.log("   National verification records…");
  const natKinds = [
    "PCN",
    "TIN",
    "DTI_NAME",
    "SEC_NAME",
    "LRA_PARCEL",
    "DISASTER_ALERT",
  ] as const;
  for (let n = 0; n < 10; n++) {
    await prisma.nationalVerificationRecord.upsert({
      where: { id: sid(23, n + 1) },
      update: {},
      create: {
        id: sid(23, n + 1),
        kind: natKinds[n % 6],
        referenceValue: `REF-FULL-${String(n + 1).padStart(6, "0")}`,
        businessId: BIDS[n * 2],
        requestedByUserId: uId("lgu-admin-tug@inspectph.dev"),
        result: {
          verified: n % 3 !== 0,
          source: "national-registry",
          checkedAt: daysAgo(n + 1).toISOString(),
        },
        verified: n % 3 !== 0,
        providerSource: "national-registry",
        expiresAt: daysFrom(90 + n * 7),
        createdAt: daysAgo(n + 1),
      },
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.lgu.count(),
    prisma.module.count(),
    prisma.office.count(),
    prisma.user.count(),
    prisma.businessEstablishment.count(),
    prisma.permitRecord.count(),
    prisma.paymentRecord.count(),
    prisma.inspection.count(),
    prisma.checklistTemplate.count(),
    prisma.inspectionChecklistResult.count(),
    prisma.finding.count(),
    prisma.correctiveActionPlan.count(),
    prisma.fireSafetyCertificate.count(),
    prisma.issueReport.count(),
    prisma.attachment.count(),
    prisma.auditLog.count(),
    prisma.notificationOutbox.count(),
    prisma.dataSubjectRequest.count(),
    prisma.findingDispute.count(),
    prisma.paymentAnomalyFlag.count(),
    prisma.lguWebhookEndpoint.count(),
    prisma.webhookDelivery.count(),
    prisma.oAuthClient.count(),
    prisma.checklistTemplateRating.count(),
    prisma.crossLguRecognitionRequest.count(),
    prisma.nationalVerificationRecord.count(),
    prisma.userOfficeAssignment.count(),
    prisma.officeModule.count(),
  ]);

  const labels = [
    "LGU",
    "Module",
    "Office",
    "User",
    "Business",
    "Permit",
    "Payment",
    "Inspection",
    "ChecklistTemplate",
    "ChecklistResult",
    "Finding",
    "CAP",
    "FireSafetyCert",
    "IssueReport",
    "Attachment",
    "AuditLog",
    "Notification",
    "DataSubjectRequest",
    "FindingDispute",
    "AnomalyFlag",
    "WebhookEndpoint",
    "WebhookDelivery",
    "OAuthClient",
    "TemplateRating",
    "CrossLguRecognition",
    "NationalVerification",
    "UserOfficeAssignment",
    "OfficeModule",
  ];

  console.log("\n✅  Full seed complete — total row counts:");
  labels.forEach((l, i) => console.log(`   ${l.padEnd(24)} ${counts[i]}`));
  console.log("\n   Login credentials (all passwords: password123)");
  console.log("   ─────────────────────────────────────────────");
  console.log("   admin-full@inspectph.dev       ADMIN");
  console.log("   lgu-admin-tug@inspectph.dev    LGU_ADMIN (Tuguegarao)");
  console.log("   sup-bplo-tug@inspectph.dev     OFFICE_SUPERVISOR");
  console.log("   insp-a@inspectph.dev            INSPECTOR (BPLO+FIRE, TUG)");
  console.log(
    "   insp-b@inspectph.dev            INSPECTOR (BUILD+SANITA, TUG)",
  );
  console.log("   insp-c@inspectph.dev            INSPECTOR (BPLO+AGRI, CAU)");
  console.log("   insp-d@inspectph.dev            INSPECTOR (BPLO+BUILD, SAN)");
  console.log("   insp-e@inspectph.dev            INSPECTOR (BPLO+AGRI, ILG)");
  console.log("   owner-a@inspectph.dev           BUSINESS_OWNER");
  console.log("   citizen-a@inspectph.dev         CITIZEN");
}

// ── helper used inside the script ────────────────────────────────────────────
function completedAtOf(inspIdx: number): Date {
  const dayOffset = [
    0, -30, -5, -20, -45, 7, -3, -15, 5, -60, -8, -25, 10, -40, -12, -50, 14,
    -70, -55, 21,
  ][inspIdx];
  const base = dayOffset >= 0 ? daysFrom(dayOffset) : daysAgo(-dayOffset);
  return new Date(base.getTime() + 7_200_000);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
