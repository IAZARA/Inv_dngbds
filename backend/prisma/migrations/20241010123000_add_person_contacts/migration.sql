-- Add JSON columns to store multiple contact entries for people
ALTER TABLE "Person"
  ADD COLUMN "emails" JSONB,
  ADD COLUMN "telefonos" JSONB,
  ADD COLUMN "redes_sociales" JSONB;
