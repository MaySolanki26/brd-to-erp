-- Extraction: chunks record when their extraction finished, and an item can have more than one source.
-- No existing rows need a value: extractedAt starts empty, so chunks stored before this migration are
-- extracted the next time their source is reprocessed.

-- AlterTable
ALTER TABLE "chunks" ADD COLUMN     "extractedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "item_sources" (
    "id" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "requirementId" UUID,
    "ruleId" UUID,
    "moduleId" UUID,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_sources_chunkId_idx" ON "item_sources"("chunkId");

-- CreateIndex
CREATE INDEX "item_sources_requirementId_idx" ON "item_sources"("requirementId");

-- CreateIndex
CREATE INDEX "item_sources_ruleId_idx" ON "item_sources"("ruleId");

-- CreateIndex
CREATE INDEX "item_sources_moduleId_idx" ON "item_sources"("moduleId");

-- CreateIndex
CREATE INDEX "item_sources_organizationId_idx" ON "item_sources"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "item_sources_chunkId_requirementId_key" ON "item_sources"("chunkId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "item_sources_chunkId_ruleId_key" ON "item_sources"("chunkId", "ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "item_sources_chunkId_moduleId_key" ON "item_sources"("chunkId", "moduleId");

-- AddForeignKey
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "business_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one item column is set per row (same rule as question_links).
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_single_item_check"
  CHECK (
    (CASE WHEN "requirementId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "ruleId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "moduleId" IS NULL THEN 0 ELSE 1 END) = 1
  );
