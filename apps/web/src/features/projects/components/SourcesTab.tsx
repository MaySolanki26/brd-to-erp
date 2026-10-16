import { useRef, useState } from 'react';
import { FileText, FileUp, StickyNote } from 'lucide-react';
import { SOURCE_FILE_ACCEPT, type ContextNoteDto, type DocumentDto } from '@brd/shared';
import {
  Button,
  EmptyState,
  NoAccess,
  PageError,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  toast,
} from '@brd/ui';
import { apiUrl } from '@/lib/api-client';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { useDocuments, useNotes, useProcessingStatus } from '../hooks/use-sources';
import { useReprocessDocument, useUploadDocument } from '../hooks/use-source-mutations';
import { formatDate } from '../project-labels';
import { checkUploadable, formatBytes } from '../source-utils';
import { DocumentDrawer } from './DocumentDrawer';
import { NoteDrawer } from './NoteDrawer';
import { SourceStatusBadge } from './SourceStatusBadge';

interface SourcesTabProps {
  projectId: string;
  canAddSource: boolean;
  canReprocess: boolean;
}

const DOCUMENT_COLUMNS = [
  { kind: 'text' },
  { kind: 'badge' },
  { kind: 'badge' },
  { kind: 'text' },
  { kind: 'icon' },
] as const;

function canRetry(document: DocumentDto): boolean {
  return document.status === 'FAILED' || document.status === 'PROCESSED';
}

export function SourcesTab({ projectId, canAddSource, canReprocess }: SourcesTabProps) {
  const documents = useDocuments(projectId);
  const notes = useNotes(projectId);
  useProcessingStatus(projectId);
  const upload = useUploadDocument(projectId);
  const reprocess = useReprocessDocument(projectId);

  const fileInput = useRef<HTMLInputElement>(null);
  const versionTarget = useRef<string | undefined>(undefined);
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ContextNoteDto | null>(null);

  const pickFile = (documentId?: string) => {
    versionTarget.current = documentId;
    fileInput.current?.click();
  };

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const problem = checkUploadable(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    upload.mutate(
      { file, ...(versionTarget.current && { documentId: versionTarget.current }) },
      {
        onSuccess: ({ document, duplicateOf }) => {
          toast.success(`${document.fileName} uploaded. Processing will start shortly.`);
          if (duplicateOf) {
            toast.warning(`Identical content already exists in "${duplicateOf.title}".`);
          }
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const retry = (document: DocumentDto) =>
    reprocess.mutate(document.id, {
      onSuccess: () => toast.success(`Reprocessing ${document.fileName}`),
      onError: (err) => toast.error(errorMessage(err)),
    });

  const openNote = (note: ContextNoteDto | null) => {
    setEditingNote(note);
    setNoteOpen(true);
  };

  if (documents.isError && isForbidden(documents.error)) {
    return <NoAccess description="You do not have access to this project's sources." />;
  }

  return (
    <div className="space-y-8">
      <input
        ref={fileInput}
        type="file"
        accept={SOURCE_FILE_ACCEPT}
        className="hidden"
        aria-label="Choose a file to upload"
        onChange={onFileChosen}
      />

      <section aria-labelledby="documents-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="documents-heading" className="text-xl font-semibold">
            Documents
          </h2>
          {canAddSource && (
            <Button size="sm" disabled={upload.isPending} onClick={() => pickFile()}>
              <FileUp className="mr-1 h-4 w-4" />
              {upload.isPending ? 'Uploading…' : 'Upload document'}
            </Button>
          )}
        </div>

        {documents.isPending && <TableSkeleton columns={[...DOCUMENT_COLUMNS]} rows={3} />}
        {documents.isError && !isForbidden(documents.error) && (
          <PageError
            message="Could not load documents"
            description={errorMessage(documents.error)}
            onRetry={() => void documents.refetch()}
          />
        )}
        {documents.isSuccess && documents.data.items.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description={
              canAddSource
                ? 'Upload a PDF, DOCX or XLSX to start building project knowledge.'
                : 'Documents added by analysts and owners appear here.'
            }
            {...(canAddSource && { actionLabel: 'Upload document', onAction: () => pickFile() })}
          />
        )}
        {documents.isSuccess && documents.data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.data.items.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => setOpenDocumentId(document.id)}
                    >
                      {document.title}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(document.latestVersion.sizeBytes)}
                    </p>
                    {document.failureReason && (
                      <p className="text-xs text-destructive">{document.failureReason}</p>
                    )}
                  </TableCell>
                  <TableCell>v{document.latestVersion.versionNumber}</TableCell>
                  <TableCell>
                    <SourceStatusBadge status={document.status} />
                  </TableCell>
                  <TableCell>{document.chunkCount}</TableCell>
                  <TableCell>
                    {formatDate(document.createdAt)}
                    <p className="text-xs text-muted-foreground">{document.createdBy.name}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={apiUrl(
                            `/projects/${projectId}/documents/${document.id}/versions/${document.latestVersion.id}/download`,
                          )}
                          download
                        >
                          Download
                        </a>
                      </Button>
                      {canAddSource && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={upload.isPending}
                          onClick={() => pickFile(document.id)}
                        >
                          New version
                        </Button>
                      )}
                      {canReprocess && canRetry(document) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reprocess.isPending}
                          onClick={() => retry(document)}
                        >
                          Reprocess
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="notes-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="notes-heading" className="text-xl font-semibold">
            Context notes
          </h2>
          {canAddSource && (
            <Button size="sm" variant="outline" onClick={() => openNote(null)}>
              <StickyNote className="mr-1 h-4 w-4" />
              Add note
            </Button>
          )}
        </div>

        {notes.isPending && (
          <TableSkeleton
            columns={[{ kind: 'text' }, { kind: 'badge' }, { kind: 'text' }]}
            rows={2}
          />
        )}
        {notes.isError && !isForbidden(notes.error) && (
          <PageError
            message="Could not load notes"
            description={errorMessage(notes.error)}
            onRetry={() => void notes.refetch()}
          />
        )}
        {notes.isSuccess && notes.data.items.length === 0 && (
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description={
              canAddSource
                ? 'Capture call summaries and decisions that are not in a document.'
                : 'Notes added by analysts and owners appear here.'
            }
          />
        )}
        {notes.isSuccess && notes.data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Updated</TableHead>
                {canAddSource && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.data.items.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="font-medium">
                    {note.title}
                    {note.failureReason && (
                      <p className="text-xs font-normal text-destructive">{note.failureReason}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <SourceStatusBadge status={note.status} />
                  </TableCell>
                  <TableCell>{note.chunkCount}</TableCell>
                  <TableCell>
                    {formatDate(note.updatedAt)}
                    <p className="text-xs text-muted-foreground">{note.createdBy.name}</p>
                  </TableCell>
                  {canAddSource && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openNote(note)}>
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {openDocumentId && (
        <DocumentDrawer
          key={openDocumentId}
          projectId={projectId}
          documentId={openDocumentId}
          onClose={() => setOpenDocumentId(null)}
        />
      )}
      <NoteDrawer
        projectId={projectId}
        open={noteOpen}
        onOpenChange={setNoteOpen}
        note={editingNote}
      />
    </div>
  );
}
