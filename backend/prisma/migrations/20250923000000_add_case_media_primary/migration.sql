-- Add flag to indicate the primary photo per case
ALTER TABLE "case_media"
ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure at most one primary photo per case
CREATE UNIQUE INDEX IF NOT EXISTS "case_media_primary_unique"
ON "case_media" ("caseId")
WHERE "is_primary" = TRUE;
