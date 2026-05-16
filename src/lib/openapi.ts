import type { OpenAPIV3 } from "openapi-types";

const spec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Inspect PH API",
    version: "1.0.0",
    description:
      "REST API powering the Inspect PH platform — inspection management, permit issuance, business records, and modular LGU compliance workflows.",
    contact: {
      name: "Inspect PH Team",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Current environment",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      PaginationMeta: {
        type: "object",
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      ApiError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      UserRecord: {
        type: "object",
        required: ["id", "email", "name", "role", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          role: {
            type: "string",
            enum: [
              "admin",
              "lgu_admin",
              "office_supervisor",
              "inspector",
              "permit_officer",
              "public",
            ],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      InspectionRecord: {
        type: "object",
        required: ["id", "status", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          referenceNumber: { type: "string" },
          status: {
            type: "string",
            enum: [
              "PENDING",
              "SCHEDULED",
              "IN_PROGRESS",
              "COMPLETED",
              "CANCELLED",
              "FAILED",
            ],
          },
          officeId: { type: "string", format: "uuid" },
          inspectorId: { type: "string", format: "uuid", nullable: true },
          scheduledAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          completedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PermitRecord: {
        type: "object",
        required: ["id", "permitType", "status", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          permitNumber: { type: "string" },
          permitType: { type: "string" },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "REVOKED"],
          },
          businessId: { type: "string", format: "uuid", nullable: true },
          issuedAt: { type: "string", format: "date-time", nullable: true },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      BusinessRecord: {
        type: "object",
        required: ["id", "name", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          tradeName: { type: "string", nullable: true },
          ownerEmail: { type: "string", format: "email", nullable: true },
          address: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ModuleRecord: {
        type: "object",
        required: ["id", "code", "name", "isActive", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          code: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ChecklistTemplateRecord: {
        type: "object",
        required: [
          "id",
          "code",
          "module",
          "title",
          "sortOrder",
          "isActive",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          code: { type: "string" },
          module: { type: "string" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          sortOrder: { type: "integer" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Service health check",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "ok" },
                        db: { type: "string", example: "ok" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        accessToken: { type: "string" },
                        refreshToken: { type: "string" },
                        user: { $ref: "#/components/schemas/UserRecord" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        operationId: "register",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "User created" },
          "409": { description: "Email already in use" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        operationId: "getMe",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/UserRecord" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/inspections": {
      get: {
        tags: ["Inspections"],
        summary: "List inspections",
        operationId: "listInspections",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10, maximum: 100 },
          },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "officeId", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of inspections",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/InspectionRecord" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/permits": {
      get: {
        tags: ["Permits"],
        summary: "List permits",
        operationId: "listPermits",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of permits",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PermitRecord" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/businesses": {
      get: {
        tags: ["Businesses"],
        summary: "List business establishments",
        operationId: "listBusinesses",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of businesses",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/BusinessRecord" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/modules": {
      get: {
        tags: ["Modules"],
        summary: "List modules",
        operationId: "listModules",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
          {
            name: "isActive",
            in: "query",
            schema: { type: "boolean" },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of modules",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ModuleRecord" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/checklist-templates": {
      get: {
        tags: ["Checklist Templates"],
        summary: "List checklist templates",
        operationId: "listChecklistTemplates",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          { name: "module", in: "query", schema: { type: "string" } },
          { name: "isActive", in: "query", schema: { type: "boolean" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of checklist templates",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/ChecklistTemplateRecord",
                      },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Checklist Templates"],
        summary: "Create a checklist template",
        operationId: "createChecklistTemplate",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code", "module", "title"],
                properties: {
                  code: { type: "string" },
                  module: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  sortOrder: { type: "integer", default: 0 },
                  isActive: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Template created" },
          "409": { description: "Code already in use" },
        },
      },
    },
    "/checklist-templates/{id}/active": {
      patch: {
        tags: ["Checklist Templates"],
        summary: "Update checklist template active state",
        operationId: "patchChecklistTemplateActive",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["isActive"],
                properties: {
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Template updated" },
          "404": { description: "Template not found" },
        },
      },
    },

    "/payments/webhook": {
      post: {
        summary: "Paymongo payment webhook",
        operationId: "paymentWebhook",
        tags: ["Payments"],
        description: "Receives Paymongo webhook events and records payment outcomes. Verifies the Paymongo signature header.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      type:       { type: "string", example: "payment.paid" },
                      attributes: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Webhook acknowledged" },
          "400": { description: "Invalid payload or signature" },
        },
      },
    },

    "/fire-safety-certificates": {
      get: {
        summary: "List fire safety inspection certificates",
        operationId: "listFireSafetyCertificates",
        tags: ["FireGuard"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page",     in: "query", schema: { type: "integer", default: 1  } },
          { name: "limit",    in: "query", schema: { type: "integer", default: 20 } },
          { name: "officeId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of certificates",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { type: "object" } },
                    meta: { type: "object", properties: { total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } } },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/reports/inspections/export": {
      get: {
        summary: "Export inspections as CSV",
        operationId: "exportInspectionsCsv",
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        description: "Admin-only. Streams a UTF-8 CSV of up to 10 000 inspection records. Supports optional query filters.",
        parameters: [
          { name: "officeId",  in: "query", schema: { type: "string" } },
          { name: "status",    in: "query", schema: { type: "string", enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELED"] } },
          { name: "fromDate",  in: "query", schema: { type: "string", format: "date" } },
          { name: "toDate",    in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          "200": {
            description: "CSV file",
            content: { "text/csv": { schema: { type: "string" } } },
          },
          "403": { description: "Forbidden — admin role required" },
        },
      },
    },

    "/issue-reports": {
      get: {
        summary: "List issue reports",
        operationId: "listIssueReports",
        tags: ["Issues"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page",     in: "query", schema: { type: "integer", default: 1  } },
          { name: "limit",    in: "query", schema: { type: "integer", default: 20 } },
          { name: "officeId", in: "query", schema: { type: "string" } },
          { name: "status",   in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Paginated list of issue reports" },
        },
      },
    },

    "/notifications": {
      get: {
        summary: "List notifications for the authenticated user",
        operationId: "listNotifications",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page",  in: "query", schema: { type: "integer", default: 1  } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "read",  in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "Paginated notifications" },
        },
      },
    },

    "/public/permits": {
      get: {
        summary: "Public permit lookup by business name or permit number",
        operationId: "publicListPermits",
        tags: ["Public"],
        parameters: [
          { name: "q",    in: "query", required: true, schema: { type: "string" }, description: "Business name or permit number" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: {
          "200": { description: "Matching permit records (no PII returned)" },
        },
      },
    },
  },
};

export default spec;
