-- Add optional JSON storage for complementary case information
ALTER TABLE "cases"
ADD COLUMN "informacion_complementaria" JSONB;
