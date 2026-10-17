-- CreateEnum
CREATE TYPE "LlmCallStatus" AS ENUM ('OK', 'INVALID_OUTPUT', 'REFUSED', 'ERROR');
-- AlterTable
ALTER TABLE "llm_usages" ADD COLUMN     "cachedTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promptName" TEXT,
ADD COLUMN     "status" "LlmCallStatus" NOT NULL DEFAULT 'OK';
-- CreateIndex
CREATE INDEX "llm_usages_projectId_createdAt_idx" ON "llm_usages"("projectId", "createdAt");
