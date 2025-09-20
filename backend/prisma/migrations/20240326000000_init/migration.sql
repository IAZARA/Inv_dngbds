CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'CONSULTANT');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");

CREATE TABLE "Person" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "identityNumber" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "birthdate" DATE,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "Person_identityNumber_key" ON "Person" ("identityNumber");

CREATE TABLE "Source" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "SourceRecord" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "personId" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "collectedById" UUID,
  "collectedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "rawPayload" JSONB,
  "summary" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SourceRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SourceRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SourceRecord_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SourceRecord_personId_idx" ON "SourceRecord" ("personId");
CREATE INDEX "SourceRecord_sourceId_idx" ON "SourceRecord" ("sourceId");

CREATE TRIGGER set_updated_at_user
BEFORE UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER set_updated_at_person
BEFORE UPDATE ON "Person"
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER set_updated_at_source
BEFORE UPDATE ON "Source"
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER set_updated_at_source_record
BEFORE UPDATE ON "SourceRecord"
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();
