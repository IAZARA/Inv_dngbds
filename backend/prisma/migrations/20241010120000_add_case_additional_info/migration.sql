-- Add optional JSON storage for complementary case information when the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'cases'
  ) THEN
    ALTER TABLE "cases"
    ADD COLUMN IF NOT EXISTS "informacion_complementaria" JSONB;
  END IF;
END $$;
