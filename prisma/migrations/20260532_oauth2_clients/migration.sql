-- Migration: OAuth2 third-party app authorization

CREATE TABLE "OAuthClient" (
  "id"           TEXT         NOT NULL,
  "clientId"     TEXT         NOT NULL,
  "clientSecret" TEXT         NOT NULL,
  "name"         TEXT         NOT NULL,
  "description"  TEXT,
  "redirectUri"  TEXT         NOT NULL,
  "scopes"       TEXT[]       NOT NULL DEFAULT '{}',
  "isActive"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OAuthClient_clientId_key" UNIQUE ("clientId")
);

CREATE INDEX "OAuthClient_clientId_idx" ON "OAuthClient"("clientId");

CREATE TABLE "OAuthAuthorizationCode" (
  "id"          TEXT         NOT NULL,
  "code"        TEXT         NOT NULL,
  "clientId"    TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  "scope"       TEXT[]       NOT NULL DEFAULT '{}',
  "redirectUri" TEXT         NOT NULL,
  "expiresAt"   TIMESTAMPTZ  NOT NULL,
  "used"        BOOLEAN      NOT NULL DEFAULT FALSE,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OAuthAuthorizationCode_code_key" UNIQUE ("code"),
  CONSTRAINT "OAuthAuthorizationCode_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE,
  CONSTRAINT "OAuthAuthorizationCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "OAuthAuthorizationCode_code_idx"     ON "OAuthAuthorizationCode"("code");
CREATE INDEX "OAuthAuthorizationCode_clientId_idx" ON "OAuthAuthorizationCode"("clientId");
CREATE INDEX "OAuthAuthorizationCode_userId_idx"   ON "OAuthAuthorizationCode"("userId");

CREATE TABLE "OAuthAccessToken" (
  "id"        TEXT         NOT NULL,
  "token"     TEXT         NOT NULL,
  "clientId"  TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "scope"     TEXT[]       NOT NULL DEFAULT '{}',
  "expiresAt" TIMESTAMPTZ  NOT NULL,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "OAuthAccessToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OAuthAccessToken_token_key" UNIQUE ("token"),
  CONSTRAINT "OAuthAccessToken_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE,
  CONSTRAINT "OAuthAccessToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "OAuthAccessToken_token_idx"    ON "OAuthAccessToken"("token");
CREATE INDEX "OAuthAccessToken_clientId_idx" ON "OAuthAccessToken"("clientId");
CREATE INDEX "OAuthAccessToken_userId_idx"   ON "OAuthAccessToken"("userId");
