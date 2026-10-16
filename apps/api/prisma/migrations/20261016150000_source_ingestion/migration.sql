-- AlterTable
ALTER TABLE "chunks" ADD COLUMN     "chunkKey" TEXT NOT NULL,
ADD COLUMN     "contentHash" TEXT NOT NULL,
ADD COLUMN     "contextNoteId" UUID,
ADD COLUMN     "headingPath" TEXT[],
ADD COLUMN     "projectId" UUID NOT NULL,
ALTER COLUMN "documentVersionId" DROP NOT NULL;
-- AlterTable
ALTER TABLE "document_versions" DROP COLUMN "fileUrl",
ADD COLUMN     "contentHash" TEXT NOT NULL,
ADD COLUMN     "createdById" UUID NOT NULL,
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ALTER COLUMN "sizeBytes" SET NOT NULL;
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "createdById" UUID NOT NULL;
-- CreateTable
CREATE TABLE "context_notes" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "projectId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "context_notes_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "context_notes_projectId_idx" ON "context_notes"("projectId");
-- CreateIndex
CREATE INDEX "context_notes_organizationId_idx" ON "context_notes"("organizationId");
-- CreateIndex
CREATE INDEX "context_notes_status_idx" ON "context_notes"("status");
-- CreateIndex
CREATE INDEX "context_notes_createdById_idx" ON "context_notes"("createdById");
-- CreateIndex
CREATE UNIQUE INDEX "chunks_chunkKey_key" ON "chunks"("chunkKey");
-- CreateIndex
CREATE INDEX "chunks_contextNoteId_idx" ON "chunks"("contextNoteId");
-- CreateIndex
CREATE INDEX "chunks_projectId_idx" ON "chunks"("projectId");
-- CreateIndex
CREATE UNIQUE INDEX "chunks_documentVersionId_chunkIndex_key" ON "chunks"("documentVersionId", "chunkIndex");
-- CreateIndex
CREATE UNIQUE INDEX "chunks_contextNoteId_chunkIndex_key" ON "chunks"("contextNoteId", "chunkIndex");
-- CreateIndex
CREATE INDEX "document_versions_contentHash_idx" ON "document_versions"("contentHash");
-- CreateIndex
CREATE INDEX "document_versions_createdById_idx" ON "document_versions"("createdById");
-- CreateIndex
CREATE INDEX "documents_createdById_idx" ON "documents"("createdById");
-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "context_notes" ADD CONSTRAINT "context_notes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "context_notes" ADD CONSTRAINT "context_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_contextNoteId_fkey" FOREIGN KEY ("contextNoteId") REFERENCES "context_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A chunk belongs to exactly one source: a document version or a context note.
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_single_source_check"
  CHECK (("documentVersionId" IS NULL) <> ("contextNoteId" IS NULL));

-- Context notes are capped at 20,000 characters (mirrors MAX_NOTE_CHARS in @brd/shared).
ALTER TABLE "context_notes" ADD CONSTRAINT "context_notes_body_length_check"
  CHECK (char_length("body") <= 20000);
