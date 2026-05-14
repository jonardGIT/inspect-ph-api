import request from "supertest";

const mockPaymentCount = jest.fn();
const mockPaymentCreate = jest.fn();
const mockPaymentFindMany = jest.fn();
const mockPaymentFindUnique = jest.fn();
const mockPaymentUpdate = jest.fn();
const mockPermitFindUnique = jest.fn();
const mockCreateCheckoutSession = jest.fn();
const mockParseWebhookEvent = jest.fn();

jest.mock("../lib/prisma.js", () => ({
  prisma: {
    paymentRecord: {
      count: mockPaymentCount,
      create: mockPaymentCreate,
      findMany: mockPaymentFindMany,
      findUnique: mockPaymentFindUnique,
      update: mockPaymentUpdate,
    },
    permitRecord: {
      findUnique: mockPermitFindUnique,
    },
  },
}));

jest.mock("../lib/payment-provider.js", () => ({
  getPaymentProvider: () => ({
    createCheckoutSession: mockCreateCheckoutSession,
    kind: "local",
    parseWebhookEvent: mockParseWebhookEvent,
  }),
}));

import app from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

describe("Payment routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  });

  it("lists payments for authenticated admins", async () => {
    const createdAt = new Date("2026-05-18T09:15:00.000Z");

    mockPaymentCount.mockResolvedValue(1);
    mockPaymentFindMany.mockResolvedValue([
      {
        amountInMinor: 125000,
        checkoutUrl:
          "http://localhost:4000/api/v1/payments/public/PAY-20260518-ABCD1234",
        createdAt,
        currency: "PHP",
        description: "Permit BPLO-2026-0001 payment",
        failedAt: null,
        failureReason: null,
        id: "payment-1",
        paidAt: null,
        permitRecord: {
          business: {
            businessName: "North Star Trading",
            id: "business-1",
          },
          id: "permit-1",
          permitNumber: "BPLO-2026-0001",
        },
        provider: "LOCAL",
        providerPaymentId: "local_payment-1",
        referenceNumber: "PAY-20260518-ABCD1234",
        status: "PROCESSING",
        updatedAt: createdAt,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/payments?page=1&limit=10&status=processing")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ limit: 10, page: 1, total: 1 });
    expect(response.body.data[0].referenceNumber).toBe("PAY-20260518-ABCD1234");
  });

  it("creates a payment checkout for admins", async () => {
    const createdAt = new Date("2026-05-18T09:15:00.000Z");

    mockPermitFindUnique.mockResolvedValue({
      business: {
        businessName: "North Star Trading",
        id: "business-1",
      },
      id: "permit-1",
      permitNumber: "BPLO-2026-0001",
    });
    mockPaymentCreate.mockResolvedValue({
      amountInMinor: 125000,
      checkoutUrl: null,
      createdAt,
      currency: "PHP",
      description: "Permit BPLO-2026-0001 payment",
      failedAt: null,
      failureReason: null,
      id: "payment-1",
      paidAt: null,
      permitRecord: {
        business: {
          businessName: "North Star Trading",
          id: "business-1",
        },
        id: "permit-1",
        permitNumber: "BPLO-2026-0001",
      },
      provider: "LOCAL",
      providerPaymentId: null,
      referenceNumber: "PAY-20260518-ABCD1234",
      status: "PENDING",
      updatedAt: createdAt,
    });
    mockCreateCheckoutSession.mockResolvedValue({
      checkoutUrl:
        "http://localhost:4000/api/v1/payments/public/PAY-20260518-ABCD1234",
      initialStatus: "processing",
      provider: "local",
      providerPaymentId: "local_payment-1",
    });
    mockPaymentUpdate.mockResolvedValue({
      amountInMinor: 125000,
      checkoutUrl:
        "http://localhost:4000/api/v1/payments/public/PAY-20260518-ABCD1234",
      createdAt,
      currency: "PHP",
      description: "Permit BPLO-2026-0001 payment",
      failedAt: null,
      failureReason: null,
      id: "payment-1",
      paidAt: null,
      permitRecord: {
        business: {
          businessName: "North Star Trading",
          id: "business-1",
        },
        id: "permit-1",
        permitNumber: "BPLO-2026-0001",
      },
      provider: "LOCAL",
      providerPaymentId: "local_payment-1",
      referenceNumber: "PAY-20260518-ABCD1234",
      status: "PROCESSING",
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post("/api/v1/payments")
      .set(
        "Authorization",
        `Bearer ${signAccessToken({ role: "admin", sub: "admin-1" })}`,
      )
      .send({
        amountInMinor: 125000,
        description: "Permit BPLO-2026-0001 payment",
        permitId: "11111111-1111-4111-8111-111111111111",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("processing");
    expect(mockCreateCheckoutSession).toHaveBeenCalled();
  });

  it("looks up a payment publicly by reference number", async () => {
    const createdAt = new Date("2026-05-18T09:15:00.000Z");

    mockPaymentFindUnique.mockResolvedValue({
      amountInMinor: 125000,
      checkoutUrl:
        "http://localhost:4000/api/v1/payments/public/PAY-20260518-ABCD1234",
      createdAt,
      currency: "PHP",
      description: "Permit BPLO-2026-0001 payment",
      failedAt: null,
      failureReason: null,
      id: "payment-1",
      paidAt: null,
      permitRecord: {
        business: {
          businessName: "North Star Trading",
          id: "business-1",
        },
        id: "permit-1",
        permitNumber: "BPLO-2026-0001",
      },
      provider: "LOCAL",
      providerPaymentId: "local_payment-1",
      referenceNumber: "PAY-20260518-ABCD1234",
      status: "PROCESSING",
      updatedAt: createdAt,
    });

    const response = await request(app).get(
      "/api/v1/payments/public/PAY-20260518-ABCD1234",
    );

    expect(response.status).toBe(200);
    expect(response.body.data.referenceNumber).toBe("PAY-20260518-ABCD1234");
  });

  it("processes a payment webhook", async () => {
    const createdAt = new Date("2026-05-18T09:15:00.000Z");
    const updatedAt = new Date("2026-05-18T10:15:00.000Z");

    mockParseWebhookEvent.mockResolvedValue({
      providerPaymentId: "local_payment-1",
      status: "paid",
    });
    mockPaymentFindUnique.mockResolvedValue({
      amountInMinor: 125000,
      checkoutUrl:
        "http://localhost:4000/api/v1/payments/public/PAY-20260518-ABCD1234",
      createdAt,
      currency: "PHP",
      description: "Permit BPLO-2026-0001 payment",
      failedAt: null,
      failureReason: null,
      id: "payment-1",
      paidAt: null,
      permitRecord: {
        business: {
          businessName: "North Star Trading",
          id: "business-1",
        },
        id: "permit-1",
        permitNumber: "BPLO-2026-0001",
      },
      provider: "LOCAL",
      providerPaymentId: "local_payment-1",
      referenceNumber: "PAY-20260518-ABCD1234",
      status: "PROCESSING",
      updatedAt: createdAt,
    });
    mockPaymentUpdate.mockResolvedValue({
      amountInMinor: 125000,
      checkoutUrl:
        "http://localhost:4000/api/v1/payments/public/PAY-20260518-ABCD1234",
      createdAt,
      currency: "PHP",
      description: "Permit BPLO-2026-0001 payment",
      failedAt: null,
      failureReason: null,
      id: "payment-1",
      paidAt: updatedAt,
      permitRecord: {
        business: {
          businessName: "North Star Trading",
          id: "business-1",
        },
        id: "permit-1",
        permitNumber: "BPLO-2026-0001",
      },
      provider: "LOCAL",
      providerPaymentId: "local_payment-1",
      referenceNumber: "PAY-20260518-ABCD1234",
      status: "PAID",
      updatedAt,
    });

    const response = await request(app)
      .post("/api/v1/payments/webhooks")
      .send({ providerPaymentId: "local_payment-1", status: "paid" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("paid");
  });
});
