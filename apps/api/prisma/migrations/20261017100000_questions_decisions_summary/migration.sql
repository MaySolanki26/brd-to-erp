-- CreateEnum
CREATE TYPE "QuestionReason" AS ENUM ('GAP', 'AMBIGUITY', 'CONFLICT', 'MISSING_RULE');
-- CreateEnum
CREATE TYPE "QuestionPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL');
-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "dedupeKey" TEXT NOT NULL,
ADD COLUMN     "dismissReason" TEXT,
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "dismissedById" UUID,
ADD COLUMN     "moduleId" UUID,
ADD COLUMN     "parentQuestionId" UUID,
ADD COLUMN     "priority" "QuestionPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "reason" "QuestionReason" NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "projectId" UUID NOT NULL;
-- CreateTable
CREATE TABLE "question_links" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "requirementId" UUID,
    "ruleId" UUID,
    "moduleId" UUID,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "question_links_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "answerId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "decidedById" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "project_summaries" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "basedOn" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_summaries_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "question_links_questionId_idx" ON "question_links"("questionId");
-- CreateIndex
CREATE INDEX "question_links_requirementId_idx" ON "question_links"("requirementId");
-- CreateIndex
CREATE INDEX "question_links_ruleId_idx" ON "question_links"("ruleId");
-- CreateIndex
CREATE INDEX "question_links_moduleId_idx" ON "question_links"("moduleId");
-- CreateIndex
CREATE INDEX "question_links_organizationId_idx" ON "question_links"("organizationId");
-- CreateIndex
CREATE UNIQUE INDEX "question_links_questionId_requirementId_key" ON "question_links"("questionId", "requirementId");
-- CreateIndex
CREATE UNIQUE INDEX "question_links_questionId_ruleId_key" ON "question_links"("questionId", "ruleId");
-- CreateIndex
CREATE UNIQUE INDEX "question_links_questionId_moduleId_key" ON "question_links"("questionId", "moduleId");
-- CreateIndex
CREATE UNIQUE INDEX "decisions_answerId_key" ON "decisions"("answerId");
-- CreateIndex
CREATE INDEX "decisions_questionId_idx" ON "decisions"("questionId");
-- CreateIndex
CREATE INDEX "decisions_decidedById_idx" ON "decisions"("decidedById");
-- CreateIndex
CREATE INDEX "decisions_projectId_createdAt_idx" ON "decisions"("projectId", "createdAt");
-- CreateIndex
CREATE INDEX "decisions_organizationId_idx" ON "decisions"("organizationId");
-- CreateIndex
CREATE INDEX "project_summaries_projectId_idx" ON "project_summaries"("projectId");
-- CreateIndex
CREATE INDEX "project_summaries_projectId_generatedAt_idx" ON "project_summaries"("projectId", "generatedAt");
-- CreateIndex
CREATE INDEX "project_summaries_organizationId_idx" ON "project_summaries"("organizationId");
-- CreateIndex
CREATE UNIQUE INDEX "project_summaries_projectId_version_key" ON "project_summaries"("projectId", "version");
-- CreateIndex
CREATE INDEX "questions_moduleId_idx" ON "questions"("moduleId");
-- CreateIndex
CREATE INDEX "questions_parentQuestionId_idx" ON "questions"("parentQuestionId");
-- CreateIndex
CREATE INDEX "questions_createdById_idx" ON "questions"("createdById");
-- CreateIndex
CREATE INDEX "questions_dismissedById_idx" ON "questions"("dismissedById");
-- CreateIndex
CREATE INDEX "questions_projectId_status_idx" ON "questions"("projectId", "status");
-- CreateIndex
CREATE INDEX "questions_projectId_priority_idx" ON "questions"("projectId", "priority");
-- CreateIndex
CREATE UNIQUE INDEX "questions_projectId_dedupeKey_key" ON "questions"("projectId", "dedupeKey");
-- CreateIndex
CREATE INDEX "answers_projectId_idx" ON "answers"("projectId");
-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "question_links" ADD CONSTRAINT "question_links_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "question_links" ADD CONSTRAINT "question_links_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "question_links" ADD CONSTRAINT "question_links_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "business_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "question_links" ADD CONSTRAINT "question_links_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "project_summaries" ADD CONSTRAINT "project_summaries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A question link points at exactly one item.
ALTER TABLE "question_links" ADD CONSTRAINT "question_links_single_item_check"
  CHECK (
    (CASE WHEN "requirementId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "ruleId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "moduleId" IS NULL THEN 0 ELSE 1 END) = 1
  );

-- Versions start at 1 and only go up.
ALTER TABLE "questions" ADD CONSTRAINT "questions_version_positive_check" CHECK ("version" >= 1);
ALTER TABLE "project_summaries" ADD CONSTRAINT "project_summaries_version_positive_check" CHECK ("version" >= 1);

-- A dismissed question always says why and when.
ALTER TABLE "questions" ADD CONSTRAINT "questions_dismissal_complete_check"
  CHECK ("status" <> 'DISMISSED' OR ("dismissReason" IS NOT NULL AND "dismissedAt" IS NOT NULL));
