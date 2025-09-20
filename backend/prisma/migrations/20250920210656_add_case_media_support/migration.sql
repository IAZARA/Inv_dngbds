/*
  Warnings:

  - The `recompensa` column on the `cases` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `estado_situacion` on the `cases` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'PASAPORTE', 'CEDULA_IDENTIDAD', 'OTRO');

-- CreateEnum
CREATE TYPE "Jurisdiccion" AS ENUM ('FEDERAL', 'PROVINCIAL', 'SIN_DATO');

-- CreateEnum
CREATE TYPE "EstadoRequerimiento" AS ENUM ('CAPTURA_VIGENTE', 'SIN_EFECTO', 'DETENIDO');

-- CreateEnum
CREATE TYPE "Recompensa" AS ENUM ('SI', 'NO', 'SIN_DATO');

-- CreateEnum
CREATE TYPE "CaseMediaKind" AS ENUM ('PHOTO', 'DOCUMENT');

-- DropForeignKey
ALTER TABLE "SourceRecord" DROP CONSTRAINT "SourceRecord_personId_fkey";

-- DropForeignKey
ALTER TABLE "person_addresses" DROP CONSTRAINT "person_addresses_address_id_fkey";

-- DropForeignKey
ALTER TABLE "person_addresses" DROP CONSTRAINT "person_addresses_person_id_fkey";

-- DropForeignKey
ALTER TABLE "person_case_offenses" DROP CONSTRAINT "person_case_offenses_person_id_case_id_fkey";

-- DropForeignKey
ALTER TABLE "person_cases" DROP CONSTRAINT "person_cases_case_id_fkey";

-- DropForeignKey
ALTER TABLE "person_cases" DROP CONSTRAINT "person_cases_person_id_fkey";

-- DropIndex
DROP INDEX "idx_cases_estado";

-- DropIndex
DROP INDEX "idx_cases_fecha";

-- DropIndex
DROP INDEX "idx_cases_fuerza";

-- DropIndex
DROP INDEX "idx_cases_numcausa";

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "documentType" "DocumentType",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "locality" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "sex" "Sex",
ADD COLUMN     "street" TEXT,
ADD COLUMN     "streetNumber" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "birthdate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Source" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SourceRecord" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "collectedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "lastLoginAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "address_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "caratula" TEXT,
ADD COLUMN     "delito" TEXT,
ADD COLUMN     "fiscalia" TEXT,
ADD COLUMN     "jurisdiccion" "Jurisdiccion" NOT NULL DEFAULT 'SIN_DATO',
ADD COLUMN     "juzgado_interventor" TEXT,
ADD COLUMN     "monto_recompensa" DECIMAL(65,30),
ADD COLUMN     "secretaria" TEXT,
ALTER COLUMN "case_id" DROP DEFAULT,
ALTER COLUMN "fecha_hecho" SET DATA TYPE TIMESTAMP(3),
DROP COLUMN "estado_situacion",
ADD COLUMN     "estado_situacion" "EstadoRequerimiento" NOT NULL,
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "actualizado_en" DROP DEFAULT,
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMP(3),
DROP COLUMN "recompensa",
ADD COLUMN     "recompensa" "Recompensa" NOT NULL DEFAULT 'SIN_DATO';

-- AlterTable
ALTER TABLE "person_addresses" ALTER COLUMN "vigente_desde" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "vigente_hasta" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "case_media" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "kind" "CaseMediaKind" NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_media_caseId_idx" ON "case_media"("caseId");

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("address_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_media" ADD CONSTRAINT "case_media_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("case_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_cases" ADD CONSTRAINT "person_cases_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_cases" ADD CONSTRAINT "person_cases_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_case_offenses" ADD CONSTRAINT "person_case_offenses_person_id_case_id_fkey" FOREIGN KEY ("person_id", "case_id") REFERENCES "person_cases"("person_id", "case_id") ON DELETE CASCADE ON UPDATE CASCADE;
