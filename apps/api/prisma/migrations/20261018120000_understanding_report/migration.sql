-- Understanding reports: versioned content, one decision per version, tracked conditions.
-- The old reports and approvals tables were never used. Their columns do not fit (no versions, no link
-- from a decision to a version), so refuse to run if they hold anything rather than guess.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "reports") OR EXISTS (SELECT 1 FROM "approvals") THEN
    RAISE EXCEPTION 'reports and approvals must be empty before this migration: they have no versions to attach existing rows to. Export or delete them first.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "ReportVersionStatus" AS ENUM ('GENERATING', 'FAILED', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'APPROVED_WITH_CONDITIONS', 'OUTDATED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'APPROVED_WITH_CONDITIONS');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('OPEN', 'MET');

-- AlterEnum
BEGIN;
CREATE TYPE "ReportType_new" AS ENUM ('UNDERSTANDING');
ALTER TABLE "reports" ALTER COLUMN "type" TYPE "ReportType_new" USING ("type"::text::"ReportType_new");
ALTER TYPE "ReportType" RENAME TO "ReportType_old";
ALTER TYPE "ReportType_new" RENAME TO "ReportType";
DROP TYPE "ReportType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_approvedById_fkey";

-- DropIndex
DROP INDEX "reports_type_idx";

-- DropIndex
DROP INDEX "reports_status_idx";

-- DropIndex
DROP INDEX "approvals_status_idx";

-- DropIndex
DROP INDEX "approvals_approvedById_idx";

-- AlterTable
ALTER TABLE "reports" DROP COLUMN "content",
DROP COLUMN "status",
DROP COLUMN "title",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "approvals" DROP COLUMN "approvedById",
DROP COLUMN "createdAt",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
ADD COLUMN     "baselineFingerprint" TEXT NOT NULL,
ADD COLUMN     "baselineHash" TEXT NOT NULL,
ADD COLUMN     "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decidedById" UUID NOT NULL,
ADD COLUMN     "decision" "ApprovalDecision" NOT NULL,
ADD COLUMN     "reportVersionId" UUID NOT NULL;

-- DropEnum
DROP TYPE "ApprovalStatus";

-- DropEnum
DROP TYPE "ReportStatus";

-- CreateTable
CREATE TABLE "report_versions" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ReportVersionStatus" NOT NULL DEFAULT 'GENERATING',
    "content" JSONB,
    "summaryVersion" INTEGER,
    "itemsFingerprint" TEXT,
    "failureReason" TEXT,
    "projectId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "submittedById" UUID,
    "submittedAt" TIMESTAMP(3),
    "outdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_conditions" (
    "id" UUID NOT NULL,
    "approvalId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "status" "ConditionStatus" NOT NULL DEFAULT 'OPEN',
    "organizationId" UUID NOT NULL,
    "updatedById" UUID,
    "metAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_versions_reportId_idx" ON "report_versions"("reportId");

-- CreateIndex
CREATE INDEX "report_versions_projectId_idx" ON "report_versions"("projectId");

-- CreateIndex
CREATE INDEX "report_versions_status_idx" ON "report_versions"("status");

-- CreateIndex
CREATE INDEX "report_versions_createdById_idx" ON "report_versions"("createdById");

-- CreateIndex
CREATE INDEX "report_versions_submittedById_idx" ON "report_versions"("submittedById");

-- CreateIndex
CREATE INDEX "report_versions_organizationId_idx" ON "report_versions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "report_versions_reportId_version_key" ON "report_versions"("reportId", "version");

-- CreateIndex
CREATE INDEX "approval_conditions_approvalId_idx" ON "approval_conditions"("approvalId");

-- CreateIndex
CREATE INDEX "approval_conditions_status_idx" ON "approval_conditions"("status");

-- CreateIndex
CREATE INDEX "approval_conditions_updatedById_idx" ON "approval_conditions"("updatedById");

-- CreateIndex
CREATE INDEX "approval_conditions_organizationId_idx" ON "approval_conditions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_projectId_type_key" ON "reports"("projectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_reportVersionId_key" ON "approvals"("reportVersionId");

-- CreateIndex
CREATE INDEX "approvals_decision_idx" ON "approvals"("decision");

-- CreateIndex
CREATE INDEX "approvals_decidedById_idx" ON "approvals"("decidedById");

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "report_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_conditions" ADD CONSTRAINT "approval_conditions_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_conditions" ADD CONSTRAINT "approval_conditions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A rejection always says why.
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_rejection_reason_check"
  CHECK ("decision" <> 'REJECTED' OR ("comment" IS NOT NULL AND length(btrim("comment")) > 0));

-- A report version's content is written once, while it is GENERATING; nothing changes it afterwards.
CREATE FUNCTION report_version_guard() RETURNS trigger AS $$
BEGIN
  IF OLD."version" IS DISTINCT FROM NEW."version" OR OLD."reportId" IS DISTINCT FROM NEW."reportId" THEN
    RAISE EXCEPTION 'A report version cannot change its number or its report';
  END IF;
  IF OLD."status" <> 'GENERATING' AND (
       OLD."content" IS DISTINCT FROM NEW."content"
       OR OLD."itemsFingerprint" IS DISTINCT FROM NEW."itemsFingerprint"
       OR OLD."summaryVersion" IS DISTINCT FROM NEW."summaryVersion"
     ) THEN
    RAISE EXCEPTION 'The content of a report version cannot change once it was generated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_versions_immutable
  BEFORE UPDATE ON "report_versions"
  FOR EACH ROW EXECUTE FUNCTION report_version_guard();

-- A decision and its baseline snapshot are never edited or removed.
CREATE FUNCTION approval_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'An approval decision cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approvals_immutable
  BEFORE UPDATE OR DELETE ON "approvals"
  FOR EACH ROW EXECUTE FUNCTION approval_guard();
