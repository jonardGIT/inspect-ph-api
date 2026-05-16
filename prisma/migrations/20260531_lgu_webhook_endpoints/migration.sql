-- Migration: LguWebhookEndpoint + WebhookDelivery

CREATE TABLE "LguWebhookEndpoint" (
  "id"        TEXT         NOT NULL,
  "lguId"     TEXT         NOT NULL,
  "url"       TEXT         NOT NULL,
  "secret"    TEXT         NOT NULL,
  "events"    TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive"  BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "LguWebhookEndpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LguWebhookEndpoint_lguId_fkey"
    FOREIGN KEY ("lguId") REFERENCES "Lgu"("id") ON DELETE CASCADE
);

CREATE INDEX "LguWebhookEndpoint_lguId_idx"   ON "LguWebhookEndpoint"("lguId");
CREATE INDEX "LguWebhookEndpoint_isActive_idx" ON "LguWebhookEndpoint"("isActive");

CREATE TABLE "WebhookDelivery" (
  "id"          TEXT         NOT NULL,
  "endpointId"  TEXT         NOT NULL,
  "event"       TEXT         NOT NULL,
  "payload"     JSONB        NOT NULL,
  "statusCode"  INTEGER,
  "attempt"     INTEGER      NOT NULL DEFAULT 1,
  "success"     BOOLEAN      NOT NULL DEFAULT FALSE,
  "sentAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "nextRetryAt" TIMESTAMPTZ,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebhookDelivery_endpointId_fkey"
    FOREIGN KEY ("endpointId") REFERENCES "LguWebhookEndpoint"("id") ON DELETE CASCADE
);

CREATE INDEX "WebhookDelivery_endpointId_idx"  ON "WebhookDelivery"("endpointId");
CREATE INDEX "WebhookDelivery_success_idx"      ON "WebhookDelivery"("success");
CREATE INDEX "WebhookDelivery_nextRetryAt_idx"  ON "WebhookDelivery"("nextRetryAt");
