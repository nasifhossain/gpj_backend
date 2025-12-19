/*
  Warnings:

  - A unique constraint covering the columns `[sectionId,fieldKey]` on the table `Field` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Field_sectionId_fieldKey_key" ON "Field"("sectionId", "fieldKey");
