import { useRef, useState } from 'react';
import { FileText, StickyNote } from 'lucide-react';
import { SOURCE_FILE_ACCEPT, type ContextNoteDto, type DocumentDto } from '@brd/shared';
import { Button, EmptyState, NoAccess, PageError, TableSkeleton, toast } from '@brd/ui';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { useDocuments, useNotes, useProcessingStatus } from '../hooks/use-sources';
import { useReprocessDocument } from '../hooks/use-source-mutations';
import { useUploadQueue } from '../hooks/use-upload-queue';
import { DocumentDrawer } from './DocumentDrawer';
import { DropZone } from './DropZone';
import { NoteDrawer } from './NoteDrawer';
import { SourcesList } from './SourcesList';
import { UploadQueue } from './UploadQueue';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';

interface SourcesTabProps {
  projectId: string;
  canAddSource: boolean;
  canReprocess: boolean;
}

const LIST_COLUMNS = [
  { kind: 'badge' },
  { kind: 'text' },
  { kind: 'text' },
  { kind: 'badge' },
  { kind: 'text' },
  { kind: 'icon' },
] as const;

interface ChunkTarget {
  documentId: string;
  versionId: string | null;
}

export function SourcesTab({ projectId, canAddSource, canReprocess }: SourcesTabProps) {
  const documents = useDocuments(projectId);
  const notes = useNotes(projectId);
  useProcessingStatus(projectId);
  const queue = useUploadQueue(projectId);
  const reprocess = useReprocessDocument(projectId);

  const versionInput = useRef<HTMLInputElement>(null);
  const versionTarget = useRef<DocumentDto | null>(null);
  const [chunkTarget, setChunkTarget] = useState<ChunkTarget | null>(null);
  const [versionsDocumentId, setVersionsDocumentId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ContextNoteDto | null>(null);

  const pickNewVersion = (document: DocumentDto) => {
    versionTarget.current = document;
    versionInput.current?.click();
  };

  const onVersionFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const target = versionTarget.current;
    if (file && target) {
      queue.add([file], { documentId: target.id, documentName: target.fileName });
    }
  };

  const retry = (document: DocumentDto) =>
    reprocess.mutate(document.id, {
      onSuccess: () => toast.success(`Reprocessing ${document.fileName}`),
    });

  const openNote = (note: ContextNoteDto | null) => {
    setEditingNote(note);
    setNoteOpen(true);
  };

  const forbidden = [documents, notes].some((q) => q.isError && isForbidden(q.error));
  if (forbidden) {
    return <NoAccess description="You do not have access to this project's sources." />;
  }

  const loading = documents.isPending || notes.isPending;
  const failed = documents.isError ? documents : notes.isError ? notes : null;
  const documentItems = documents.data?.items ?? [];
  const noteItems = notes.data?.items ?? [];
  const isEmpty =
    documents.isSuccess && notes.isSuccess && documentItems.length + noteItems.length === 0;

  return (
    <div className="space-y-6">
      <input
        ref={versionInput}
        type="file"
        accept={SOURCE_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a file for the new version"
        onChange={onVersionFile}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Sources</h2>
        {canAddSource && (
          <Button size="sm" variant="outline" onClick={() => openNote(null)}>
            <StickyNote className="mr-1 h-4 w-4" />
            Add context note
          </Button>
        )}
      </div>

      <DropZone canAddSource={canAddSource} onFiles={(files) => queue.add(files)} />

      <UploadQueue
        items={queue.items}
        onCancel={queue.cancel}
        onRetry={queue.retry}
        onDismiss={queue.dismiss}
        onClearFinished={queue.clearFinished}
        onOpenDocument={(documentId) => setChunkTarget({ documentId, versionId: null })}
      />

      {loading && <TableSkeleton columns={[...LIST_COLUMNS]} rows={3} />}
      {failed && (
        <PageError
          message="Could not load sources"
          description={errorMessage(failed.error)}
          onRetry={() => {
            void documents.refetch();
            void notes.refetch();
          }}
        />
      )}
      {isEmpty && (
        <EmptyState
          icon={FileText}
          title="No sources yet"
          description={
            canAddSource
              ? 'Drop a PDF, DOCX or XLSX above, or add a context note, to start building project knowledge.'
              : 'Documents and notes added by analysts and owners appear here.'
          }
        />
      )}
      {documents.isSuccess && notes.isSuccess && !isEmpty && (
        <SourcesList
          projectId={projectId}
          documents={documentItems}
          notes={noteItems}
          canAddSource={canAddSource}
          canReprocess={canReprocess}
          reprocessing={reprocess.isPending}
          onViewChunks={(documentId) => setChunkTarget({ documentId, versionId: null })}
          onViewVersions={setVersionsDocumentId}
          onNewVersion={pickNewVersion}
          onEditNote={openNote}
          onReprocess={retry}
        />
      )}

      {chunkTarget && (
        <DocumentDrawer
          key={`${chunkTarget.documentId}:${chunkTarget.versionId ?? 'latest'}`}
          projectId={projectId}
          documentId={chunkTarget.documentId}
          initialVersionId={chunkTarget.versionId}
          onClose={() => setChunkTarget(null)}
        />
      )}
      <VersionHistoryDrawer
        projectId={projectId}
        documentId={versionsDocumentId}
        onClose={() => setVersionsDocumentId(null)}
        onViewChunks={(documentId, versionId) => {
          setVersionsDocumentId(null);
          setChunkTarget({ documentId, versionId });
        }}
      />
      <NoteDrawer
        projectId={projectId}
        open={noteOpen}
        onOpenChange={setNoteOpen}
        note={editingNote}
      />
    </div>
  );
}
