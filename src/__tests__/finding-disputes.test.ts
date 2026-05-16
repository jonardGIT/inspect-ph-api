import request from "supertest";

const mockFindingFindUnique = jest.fn();
const mockFindingDisputeFindUnique = jest.fn();
const mockFindingDisputeCreate = jest.fn();
const mockFindingDisputeUpdate = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
    },
    finding: {
      findUnique: mockFindingFindUnique,
    },
    findingDispute: {
      create: mockFindingDisputeCreate,
      findUnique: mockFindingDisputeFindUnique,
      update: mockFindingDisputeUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const FINDING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function makeToken(
  userId: string,
  role:
    | "admin"
    | "business_owner"
    | "inspector"
    | "lgu_admin"
    | "office_supervisor"
    | "office_clerk"
    | "citizen",
) {
  return signAccessToken({ sub: userId, role });
}

const disputeRecord = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  findingId: FINDING_ID,
  reason: "I disagree with this finding",
  status: "PENDING",
  resolution: null,
  resolvedAt: null,
  resolvedByUserId: null,
  disputedByUserId: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  disputedBy: {
    id: USER_ID,
    name: "Business Owner",
    email: "owner@example.com",
  },
  finding: {
    id: FINDING_ID,
    title: "Missing sprinkler",
    severity: "HIGH",
    inspectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  },
  resolvedBy: null,
};

describe("Finding dispute routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";

    // Default: admin user
    mockUserFindUnique.mockResolvedValue({
      id: USER_ID,
      lguId: null,
      officeAssignments: [],
    });
    mockAuditLogCreate.mockResolvedValue({ id: "audit-1" });
  });

  describe("POST /api/v1/findings/:findingId/dispute", () => {
    it("creates a dispute and returns 201", async () => {
      mockFindingFindUnique.mockResolvedValue({
        id: FINDING_ID,
        title: "Missing sprinkler",
        inspection: {
          business: { ownerUsers: [{ id: USER_ID }] },
        },
      });
      mockFindingDisputeFindUnique.mockResolvedValue(null);
      mockFindingDisputeCreate.mockResolvedValue(disputeRecord);

      const token = makeToken(USER_ID, "business_owner");
      const res = await request(app)
        .post(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "I disagree with this finding" });

      expect(res.status).toBe(201);
      expect(res.body.data.findingId).toBe(FINDING_ID);
    });

    it("returns 409 if dispute already exists", async () => {
      mockFindingFindUnique.mockResolvedValue({
        id: FINDING_ID,
        title: "Missing sprinkler",
        inspection: {
          business: { ownerUsers: [{ id: USER_ID }] },
        },
      });
      mockFindingDisputeFindUnique.mockResolvedValue(disputeRecord);

      const token = makeToken(USER_ID, "business_owner");
      const res = await request(app)
        .post(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "I disagree" });

      expect(res.status).toBe(409);
    });

    it("returns 403 if the user is not the business owner", async () => {
      mockFindingFindUnique.mockResolvedValue({
        id: FINDING_ID,
        title: "Missing sprinkler",
        inspection: {
          business: { ownerUsers: [] }, // different owner
        },
      });
      mockFindingDisputeFindUnique.mockResolvedValue(null);

      const token = makeToken(USER_ID, "business_owner");
      const res = await request(app)
        .post(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "I disagree" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/findings/:findingId/dispute", () => {
    it("returns the existing dispute", async () => {
      mockFindingDisputeFindUnique.mockResolvedValue(disputeRecord);
      mockUserFindUnique.mockResolvedValue({
        id: ADMIN_ID,
        lguId: null,
        officeAssignments: [],
      });

      const token = makeToken(ADMIN_ID, "admin");
      const res = await request(app)
        .get(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("pending");
    });

    it("returns 404 when no dispute exists", async () => {
      mockFindingDisputeFindUnique.mockResolvedValue(null);
      mockUserFindUnique.mockResolvedValue({
        id: ADMIN_ID,
        lguId: null,
        officeAssignments: [],
      });

      const token = makeToken(ADMIN_ID, "admin");
      const res = await request(app)
        .get(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/findings/:findingId/dispute", () => {
    it("admin can update dispute status to REVIEWING", async () => {
      mockFindingDisputeFindUnique.mockResolvedValue(disputeRecord);
      mockFindingDisputeUpdate.mockResolvedValue({
        ...disputeRecord,
        status: "REVIEWING",
      });
      mockUserFindUnique.mockResolvedValue({
        id: ADMIN_ID,
        lguId: null,
        officeAssignments: [],
      });

      const token = makeToken(ADMIN_ID, "admin");
      const res = await request(app)
        .patch(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "REVIEWING" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("reviewing");
    });

    it("returns 409 if dispute is already terminal", async () => {
      mockFindingDisputeFindUnique.mockResolvedValue({
        ...disputeRecord,
        status: "UPHELD",
      });
      mockUserFindUnique.mockResolvedValue({
        id: ADMIN_ID,
        lguId: null,
        officeAssignments: [],
      });

      const token = makeToken(ADMIN_ID, "admin");
      const res = await request(app)
        .patch(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "OVERTURNED" });

      expect(res.status).toBe(409);
    });

    it("returns 403 when business_owner tries to resolve", async () => {
      const token = makeToken(USER_ID, "business_owner");
      const res = await request(app)
        .patch(`/api/v1/findings/${FINDING_ID}/dispute`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "REVIEWING" });

      expect(res.status).toBe(403);
    });
  });
});
