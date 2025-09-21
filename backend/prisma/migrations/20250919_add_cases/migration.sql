CREATE TABLE IF NOT EXISTS "addresses" (
  "address_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "address_text" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "person_addresses" (
  "person_id" UUID NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
  "address_id" UUID NOT NULL REFERENCES "addresses"("address_id") ON DELETE CASCADE,
  "principal" BOOLEAN NOT NULL DEFAULT FALSE,
  "vigente_desde" DATE,
  "vigente_hasta" DATE,
  PRIMARY KEY ("person_id", "address_id")
);

CREATE TABLE IF NOT EXISTS "cases" (
  "case_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "numero_expediente" TEXT,
  "numero_causa" TEXT,
  "fecha_hecho" DATE,
  "estado_situacion" TEXT NOT NULL,
  "fuerza_asignada" TEXT,
  "informacion_complementaria" JSONB,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."actualizado_en" := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cases_updated
BEFORE UPDATE ON "cases"
FOR EACH ROW EXECUTE FUNCTION set_cases_updated_at();

CREATE TABLE IF NOT EXISTS "person_cases" (
  "person_id" UUID NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
  "case_id" UUID NOT NULL REFERENCES "cases"("case_id") ON DELETE CASCADE,
  "rol" TEXT,
  PRIMARY KEY ("person_id", "case_id")
);

CREATE TABLE IF NOT EXISTS "person_case_offenses" (
  "person_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "delito_texto" TEXT NOT NULL,
  PRIMARY KEY ("person_id", "case_id", "delito_texto"),
  FOREIGN KEY ("person_id", "case_id") REFERENCES "person_cases"("person_id", "case_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cases_estado ON "cases" ("estado_situacion");
CREATE INDEX IF NOT EXISTS idx_cases_fuerza ON "cases" ("fuerza_asignada");
CREATE INDEX IF NOT EXISTS idx_cases_fecha ON "cases" ("fecha_hecho");
CREATE INDEX IF NOT EXISTS idx_cases_numcausa ON "cases" ("numero_causa");
