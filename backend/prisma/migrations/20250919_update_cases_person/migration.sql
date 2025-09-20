DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PersonNationality') THEN
    CREATE TYPE "PersonNationality" AS ENUM ('ARGENTINA', 'OTRO');
  END IF;
END $$;

ALTER TABLE "cases"
  ADD COLUMN IF NOT EXISTS "recompensa" TEXT;

ALTER TABLE "Person"
  ADD COLUMN IF NOT EXISTS "nationality" "PersonNationality" NOT NULL DEFAULT 'ARGENTINA',
  ADD COLUMN IF NOT EXISTS "otherNationality" TEXT;

UPDATE "Person"
SET "nationality" = 'ARGENTINA'
WHERE "nationality" IS NULL;
