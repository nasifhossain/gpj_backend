/*
  Warnings:

  - A unique constraint covering the columns `[fieldId,updatedById]` on the table `FieldValue` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sectionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FieldValue_fieldId_updatedById_key" ON "FieldValue"("fieldId", "updatedById");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
