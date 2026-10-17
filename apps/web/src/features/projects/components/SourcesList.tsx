import { useMemo, useState } from 'react';
import type { ContextNoteDto, DocumentDto } from '@brd/shared';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@brd/ui';
import { FileText } from 'lucide-react';
import { apiUrl } from '@/lib/api-client';
import { formatDate } from '../project-labels';
import { fileKindLabel, formatBytes } from '../source-utils';
import { SourceStatusBadge } from './SourceStatusBadge';

type Filter = 'all' | 'documents' | 'notes';

type Row =
  | { kind: 'document'; id: string; activity: string; document: DocumentDto }
  | { kind: 'note'; id: string; activity: string; note: ContextNoteDto };

interface SourcesListProps {
  projectId: string;
  documents: DocumentDto[];
  notes: ContextNoteDto[];
  canAddSource: boolean;
  canReprocess: boolean;
  reprocessing: boolean;
  onViewChunks: (documentId: string) => void;
  onViewVersions: (documentId: string) => void;
  onNewVersion: (document: DocumentDto) => void;
  onEditNote: (note: ContextNoteDto) => void;
  onReprocess: (document: DocumentDto) => void;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'documents', label: 'Documents' },
  { value: 'notes', label: 'Notes' },
];

function canRetry(document: DocumentDto): boolean {
  return document.status === 'FAILED' || document.status === 'PROCESSED';
}

interface DocumentRowProps {
  projectId: string;
  document: DocumentDto;
  canAddSource: boolean;
  canReprocess: boolean;
  reprocessing: boolean;
  onViewChunks: (documentId: string) => void;
  onViewVersions: (documentId: string) => void;
  onNewVersion: (document: DocumentDto) => void;
  onRequestReprocess: (document: DocumentDto) => void;
}

function DocumentRow({
  projectId,
  document,
  canAddSource,
  canReprocess,
  reprocessing,
  onViewChunks,
  onViewVersions,
  onNewVersion,
  onRequestReprocess,
}: DocumentRowProps) {
  const latest = document.latestVersion;
  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline">{fileKindLabel(latest.mimeType)}</Badge>
      </TableCell>
      <TableCell>
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={() => onViewChunks(document.id)}
        >
          {document.title}
        </button>
        <p className="text-xs text-muted-foreground">
          {formatBytes(latest.sizeBytes)} · {document.chunkCount} chunk
          {document.chunkCount === 1 ? '' : 's'}
        </p>
        {document.failureReason && (
          <p className="text-xs text-destructive">{document.failureReason}</p>
        )}
      </TableCell>
      <TableCell>v{latest.versionNumber}</TableCell>
      <TableCell>
        <SourceStatusBadge status={document.status} />
      </TableCell>
      <TableCell>
        {formatDate(document.createdAt)}
        <p className="text-xs text-muted-foreground">{document.createdBy.name}</p>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={`Version history for ${document.fileName}`}
            onClick={() => onViewVersions(document.id)}
          >
            Versions ({document.versionCount})
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={apiUrl(
                `/projects/${projectId}/documents/${document.id}/versions/${latest.id}/download`,
              )}
              download
              aria-label={`Download ${document.fileName}`}
            >
              Download
            </a>
          </Button>
          {canAddSource && (
            <Button
              variant="outline"
              size="sm"
              aria-label={`Upload a new version of ${document.fileName}`}
              onClick={() => onNewVersion(document)}
            >
              New version
            </Button>
          )}
          {canReprocess && canRetry(document) && (
            <Button
              variant="outline"
              size="sm"
              aria-label={`Reprocess ${document.fileName}`}
              disabled={reprocessing}
              onClick={() => onRequestReprocess(document)}
            >
              Reprocess
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

interface NoteRowProps {
  note: ContextNoteDto;
  canAddSource: boolean;
  onEditNote: (note: ContextNoteDto) => void;
}

function NoteRow({ note, canAddSource, onEditNote }: NoteRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Badge variant="secondary">Note</Badge>
      </TableCell>
      <TableCell>
        <span className="font-medium">{note.title}</span>
        <p className="text-xs text-muted-foreground">
          {note.chunkCount} chunk{note.chunkCount === 1 ? '' : 's'}
        </p>
        {note.failureReason && <p className="text-xs text-destructive">{note.failureReason}</p>}
      </TableCell>
      <TableCell aria-label="No versions">—</TableCell>
      <TableCell>
        <SourceStatusBadge status={note.status} />
      </TableCell>
      <TableCell>
        {formatDate(note.createdAt)}
        <p className="text-xs text-muted-foreground">{note.createdBy.name}</p>
      </TableCell>
      <TableCell className="text-right">
        {canAddSource && (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Edit note ${note.title}`}
            onClick={() => onEditNote(note)}
          >
            Edit
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function SourcesList({
  projectId,
  documents,
  notes,
  canAddSource,
  canReprocess,
  reprocessing,
  onViewChunks,
  onViewVersions,
  onNewVersion,
  onEditNote,
  onReprocess,
}: SourcesListProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [confirming, setConfirming] = useState<DocumentDto | null>(null);

  const rows = useMemo<Row[]>(() => {
    const all: Row[] = [
      ...documents.map((document) => ({
        kind: 'document' as const,
        id: document.id,
        activity: document.updatedAt,
        document,
      })),
      ...notes.map((note) => ({
        kind: 'note' as const,
        id: note.id,
        activity: note.updatedAt,
        note,
      })),
    ];
    return all
      .filter((row) => filter === 'all' || (filter === 'documents') === (row.kind === 'document'))
      .sort((a, b) => b.activity.localeCompare(a.activity));
  }, [documents, notes, filter]);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filter sources" className="flex gap-1">
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'secondary' : 'ghost'}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing matches this filter"
          description="Try another filter to see more sources."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) =>
              row.kind === 'document' ? (
                <DocumentRow
                  key={`d-${row.id}`}
                  projectId={projectId}
                  document={row.document}
                  canAddSource={canAddSource}
                  canReprocess={canReprocess}
                  reprocessing={reprocessing}
                  onViewChunks={onViewChunks}
                  onViewVersions={onViewVersions}
                  onNewVersion={onNewVersion}
                  onRequestReprocess={setConfirming}
                />
              ) : (
                <NoteRow
                  key={`n-${row.id}`}
                  note={row.note}
                  canAddSource={canAddSource}
                  onEditNote={onEditNote}
                />
              ),
            )}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Reprocess document?"
        description={`${confirming?.fileName ?? 'This document'} will be parsed again and its chunks rebuilt.`}
        confirmLabel="Reprocess"
        isPending={reprocessing}
        onConfirm={() => {
          if (confirming) onReprocess(confirming);
          setConfirming(null);
        }}
      />
    </div>
  );
}
