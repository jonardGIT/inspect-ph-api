-- Cross-LGU mutual recognition requests

CREATE TABLE "CrossLguRecognitionRequest" (
    "id"                TEXT NOT NULL,
    "requestingLguId"   TEXT NOT NULL,
    "issuingLguId"      TEXT,
    "certificateNumber" TEXT NOT NULL,
    "businessName"      TEXT NOT NULL,
    "status"            TEXT NOT NULL DEFAULT 'PENDING_CONSENT',
    "requestedByUserId" TEXT,
    "consentOwnerId"    TEXT,
    "complianceScore"   INTEGER,
    "complianceGrade"   TEXT,
    "signedPayload"     TEXT,
    "signature"         TEXT,
    "consentGivenAt"    TIMESTAMP(3),
    "resolvedAt"        TIMESTAMP(3),
    "resolvedByUserId"  TEXT,
    "expiresAt"         TIMESTAMP(3) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossLguRecognitionRequest_pkey" PRIMARY KEY ("id")
);

-- Foreign keys

ALTER TABLE "CrossLguRecognitionRequest"
    ADD CONSTRAINT "CrossLguRecognitionRequest_requestingLguId_fkey"
    FOREIGN KEY ("requestingLguId") REFERENCES "Lgu"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrossLguRecognitionRequest"
    ADD CONSTRAINT "CrossLguRecognitionRequest_issuingLguId_fkey"
    FOREIGN KEY ("issuingLguId") REFERENCES "Lgu"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrossLguRecognitionRequest"
    ADD CONSTRAINT "CrossLguRecognitionRequest_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrossLguRecognitionRequest"
    ADD CONSTRAINT "CrossLguRecognitionRequest_consentOwnerId_fkey"
    FOREIGN KEY ("consentOwnerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrossLguRecognitionRequest"
    ADD CONSTRAINT "CrossLguRecognitionRequest_resolvedByUserId_fkey"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes

CREATE INDEX "CrossLguRecognitionRequest_requestingLguId_idx"
    ON "CrossLguRecognitionRequest"("requestingLguId");

CREATE INDEX "CrossLguRecognitionRequest_issuingLguId_idx"
    ON "CrossLguRecognitionRequest"("issuingLguId");

CREATE INDEX "CrossLguRecognitionRequest_certificateNumber_idx"
    ON "CrossLguRecognitionRequest"("certificateNumber");

CREATE INDEX "CrossLguRecognitionRequest_status_idx"
    ON "CrossLguRecognitionRequest"("status");

CREATE INDEX "CrossLguRecognitionRequest_consentOwnerId_idx"
    ON "CrossLguRecognitionRequest"("consentOwnerId");
