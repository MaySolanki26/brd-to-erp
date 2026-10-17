-- Business rules and modules now require a source chunk and modules belong to a project.
-- Rows written before this migration cannot be given one, so refuse to guess.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "business_rules") OR EXISTS (SELECT 1 FROM "modules") THEN
    RAISE EXCEPTION 'business_rules and modules must be empty before this migration: existing rows have no source chunk or project. Export or delete them first.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('CONFIRMED', 'ASSUMED', 'OPEN', 'REJECTED', 'NEEDS_REVALIDATION');

-- DropIndex
DROP INDEX "modules_organizationId_code_key";

-- AlterTable
ALTER TABLE "business_rules" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "moduleId" UUID,
ADD COLUMN     "sourceChunkId" UUID NOT NULL,
ADD COLUMN     "status" "KnowledgeStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "chunks" ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "projectId" UUID NOT NULL,
ADD COLUMN     "sourceChunkId" UUID NOT NULL,
ADD COLUMN     "status" "KnowledgeStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable: keep existing requirement statuses; RECOMMENDED is not part of the spec and becomes OPEN.
ALTER TABLE "requirements" ADD COLUMN     "createdById" UUID;
ALTER TABLE "requirements" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "requirements" ALTER COLUMN "status" TYPE "KnowledgeStatus"
  USING (CASE "status"::text WHEN 'RECOMMENDED' THEN 'OPEN' ELSE "status"::text END)::"KnowledgeStatus";
ALTER TABLE "requirements" ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- DropEnum
DROP TYPE "RequirementStatus";

-- CreateIndex
CREATE INDEX "business_rules_sourceChunkId_idx" ON "business_rules"("sourceChunkId");

-- CreateIndex
CREATE INDEX "business_rules_moduleId_idx" ON "business_rules"("moduleId");

-- CreateIndex
CREATE INDEX "business_rules_status_idx" ON "business_rules"("status");

-- CreateIndex
CREATE INDEX "business_rules_createdById_idx" ON "business_rules"("createdById");

-- CreateIndex
CREATE INDEX "modules_projectId_idx" ON "modules"("projectId");

-- CreateIndex
CREATE INDEX "modules_status_idx" ON "modules"("status");

-- CreateIndex
CREATE INDEX "modules_sourceChunkId_idx" ON "modules"("sourceChunkId");

-- CreateIndex
CREATE INDEX "modules_createdById_idx" ON "modules"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "modules_projectId_code_key" ON "modules"("projectId", "code");

-- CreateIndex
CREATE INDEX "requirements_createdById_idx" ON "requirements"("createdById");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_rules" ADD CONSTRAINT "business_rules_sourceChunkId_fkey" FOREIGN KEY ("sourceChunkId") REFERENCES "chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_rules" ADD CONSTRAINT "business_rules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_rules" ADD CONSTRAINT "business_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_sourceChunkId_fkey" FOREIGN KEY ("sourceChunkId") REFERENCES "chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

