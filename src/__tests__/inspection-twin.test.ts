const mockInspectionFindMany = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    inspection: {
      findMany: mockInspectionFindMany,
    },
  },
}));

import { getInspectionTwinSimulation } from "../services/inspection-twin.js";

describe("getInspectionTwinSimulation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queries the last completed inspections window and returns simulated failures", async () => {
    const scheduledAt = new Date("2026-01-05T08:00:00.000Z");
    const completedAt = new Date("2026-03-18T11:30:00.000Z");

    mockInspectionFindMany.mockResolvedValue([
      {
        business: {
          businessName: "North Star Trading",
          id: "business-1",
        },
        checklistResults: [{ status: "FAIL" }, { status: "PASS" }],
        completedAt,
        findings: [{ severity: "CRITICAL" }],
        id: "inspection-1",
        moduleCode: "FIRE",
        office: {
          code: "FIRE-01",
          id: "office-1",
          name: "Fire Safety Office",
        },
        permitRecord: {
          permitNumber: "FSIC-2026-001",
        },
        scheduledAt,
      },
    ]);

    const result = await getInspectionTwinSimulation({
      failOnCriticalSeverity: true,
      failOnHighSeverity: false,
      fromDate: "2026-03-01T00:00:00.000Z",
      maxFailedChecklistItems: 0,
      minChecklistPassRatePct: 80,
      moduleCode: "FIRE",
      officeId: "office-1",
      toDate: "2026-03-31T23:59:59.999Z",
    });

    expect(mockInspectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { completedAt: "desc" },
        where: {
          AND: [
            {
              completedAt: {
                gte: new Date("2026-03-01T00:00:00.000Z"),
                lte: new Date("2026-03-31T23:59:59.999Z"),
              },
              status: "COMPLETED",
            },
            { moduleCode: "FIRE" },
            { officeId: "office-1" },
          ],
        },
      }),
    );

    expect(result.inspectionsEvaluated).toBe(1);
    expect(result.simulatedFailedCount).toBe(1);
    expect(result.failureRatePct).toBe(100);
    expect(result.records[0]).toMatchObject({
      businessName: "North Star Trading",
      checklistPassRatePct: 50,
      completedAt: completedAt.toISOString(),
      moduleCode: "FIRE",
      permitNumber: "FSIC-2026-001",
      simulatedOutcome: "fail",
    });
    expect(result.records[0]?.reasons).toEqual([
      "Checklist pass rate below 80%",
      "Failed checklist items above 0",
      "Contains CRITICAL severity findings",
    ]);
  });

  it("returns a passing simulation when no rules are triggered", async () => {
    const completedAt = new Date("2026-03-18T11:30:00.000Z");

    mockInspectionFindMany.mockResolvedValue([
      {
        business: {
          businessName: "Harbor Foods",
          id: "business-2",
        },
        checklistResults: [{ status: "PASS" }, { status: "NOT_APPLICABLE" }],
        completedAt,
        findings: [],
        id: "inspection-2",
        moduleCode: null,
        office: {
          code: "SAN-01",
          id: "office-2",
          name: "Sanitation Office",
        },
        permitRecord: {
          permitNumber: "SAN-2026-002",
        },
        scheduledAt: new Date("2026-03-18T10:00:00.000Z"),
      },
    ]);

    const result = await getInspectionTwinSimulation({
      failOnCriticalSeverity: true,
      failOnHighSeverity: true,
      maxFailedChecklistItems: 2,
      minChecklistPassRatePct: 75,
    });

    expect(result.simulatedFailedCount).toBe(0);
    expect(result.simulatedPassCount).toBe(1);
    expect(result.topReasons).toEqual([]);
    expect(result.records[0]).toMatchObject({
      checklistPassRatePct: 100,
      completedAt: completedAt.toISOString(),
      simulatedOutcome: "pass",
      totalChecklistItems: 1,
    });
  });
});
