import { useMemo, useState } from 'react';
import { z } from 'zod';
import type { ContextNoteDto, DocumentDto } from '@brd/shared';
import {
  Badge,
  ConfirmDialog,
  DataTable,
  EmptyValue,
  TruncatedText,
  type DataTableColumnDef,
  type RowAction,
} from '@brd/ui';
import { FileText } from 'lucide-react';
import { useUrlState } from '@/hooks/use-url-state';
import { apiUrl } from '@/lib/api-client';
import { fileKindLabel, formatBytes } from '../source-utils';
import { SourceStatusBadge } from './SourceStatusBadge';

const URL_STATE = z.object({ sources: z.enum(['all', 'documents', 'notes']).catch('all') });
type Filter = z.infer<typeof URL_STATE>['sources'];

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
  /** Buttons at the right end of the tools line, such as "Add context note". */
  toolbarActions?: React.ReactNode;
  onViewChunks: (documentId: string) => void;
  onViewVersions: (documentId: string) => void;
  onNewVersion: (document: DocumentDto) => void;
  onEditNote: (note: ContextNoteDto) => void;
  onReprocess: (document: DocumentDto) => void;
}

const FILTER_OPTIONS = [
  { value: 'documents', label: 'Documents' },
  { value: 'notes', label: 'Notes' },
];

const NOUN = { one: 'source', other: 'sources' };

function canRetry(document: DocumentDto): boolean {
  return document.status === 'FAILED' || document.status === 'PROCESSED';
}

const plural = (count: number, word: string): string =>
  `${String(count)} ${word}${count === 1 ? '' : 's'}`;

function downloadDocument(projectId: string, document: DocumentDto): void {
  const link = window.document.createElement('a');
  link.href = apiUrl(
    `/projects/${projectId}/documents/${document.id}/versions/${document.latestVersion.id}/download`,
  );
  link.download = '';
  link.click();
}

export function SourcesList({
  projectId,
  documents,
  notes,
  canAddSource,
  canReprocess,
  reprocessing,
  toolbarActions,
  onViewChunks,
  onViewVersions,
  onNewVersion,
  onEditNote,
  onReprocess,
}: SourcesListProps) {
  const [{ sources: filter }, setUrlState] = useUrlState(URL_STATE);
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

  const columns: DataTableColumnDef<Row>[] = [
    {
      id: 'type',
      header: 'Type',
      width: 90,
      cell: (row) => (
        <Badge variant="outline">
          {row.kind === 'document' ? fileKindLabel(row.document.latestVersion.mimeType) : 'Note'}
        </Badge>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      width: 300,
      canHide: false,
      cell: (row) =>
        row.kind === 'document' ? (
          <button type="button" className="uab-link" onClick={() => onViewChunks(row.document.id)}>
            <TruncatedText text={row.document.title} />
          </button>
        ) : (
          <TruncatedText text={row.note.title} />
        ),
    },
    {
      id: 'details',
      header: 'Details',
      width: 220,
      cell: (row) => {
        const failure =
          row.kind === 'document' ? row.document.failureReason : row.note.failureReason;
        const summary =
          row.kind === 'document'
            ? `${formatBytes(row.document.latestVersion.sizeBytes)} · ${plural(row.document.chunkCount, 'chunk')}`
            : plural(row.note.chunkCount, 'chunk');
        return (
          <div className="min-w-0">
            <div>{summary}</div>
            {failure && <TruncatedText text={failure} className="uab-field-error" />}
          </div>
        );
      },
    },
    {
      id: 'version',
      header: 'Version',
      width: 90,
      cell: (row) =>
        row.kind === 'document' ? (
          `v${String(row.document.latestVersion.versionNumber)}`
        ) : (
          <EmptyValue label="No versions" />
        ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 140,
      cell: (row) => (
        <SourceStatusBadge
          status={row.kind === 'document' ? row.document.status : row.note.status}
        />
      ),
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      kind: 'date',
      width: 140,
    },
    {
      id: 'by',
      header: 'By',
      width: 150,
      cell: (row) =>
        row.kind === 'document' ? row.document.createdBy.name : row.note.createdBy.name,
    },
  ];
  // Dates come from the row's own record, not a top-level field.
  const data = rows.map((row) => ({
    ...row,
    uploaded: row.kind === 'document' ? row.document.createdAt : row.note.createdAt,
  }));

  const actions: RowAction<Row>[] = [
    {
      key: 'versions',
      label: (row) =>
        row.kind === 'document' ? `Version history for ${row.document.fileName}` : 'No versions',
      icon: 'history',
      quick: true,
      hidden: (row) => row.kind !== 'document',
      onClick: (row) => row.kind === 'document' && onViewVersions(row.document.id),
    },
    {
      key: 'download',
      label: (row) => (row.kind === 'document' ? `Download ${row.document.fileName}` : 'Download'),
      icon: 'download',
      quick: true,
      hidden: (row) => row.kind !== 'document',
      onClick: (row) => row.kind === 'document' && downloadDocument(projectId, row.document),
    },
    {
      key: 'edit-note',
      label: (row) => (row.kind === 'note' ? `Edit note ${row.note.title}` : 'Edit'),
      icon: 'pencil',
      quick: true,
      hidden: (row) => row.kind !== 'note' || !canAddSource,
      onClick: (row) => row.kind === 'note' && onEditNote(row.note),
    },
    {
      key: 'new-version',
      label: (row) =>
        row.kind === 'document'
          ? `Upload a new version of ${row.document.fileName}`
          : 'New version',
      icon: 'upload',
      quick: true,
      hidden: (row) => row.kind !== 'document' || !canAddSource,
      onClick: (row) => row.kind === 'document' && onNewVersion(row.document),
    },
    {
      key: 'reprocess',
      label: (row) =>
        row.kind === 'document' ? `Reprocess ${row.document.fileName}` : 'Reprocess',
      icon: 'reset',
      quick: true,
      hidden: (row) => row.kind !== 'document' || !canReprocess || !canRetry(row.document),
      disabledReason: () => (reprocessing ? 'Working…' : undefined),
      onClick: (row) => row.kind === 'document' && setConfirming(row.document),
    },
  ];

  return (
    <>
      <DataTable<(typeof data)[number]>
        ariaLabel="Sources table"
        noun={NOUN}
        columns={columns as DataTableColumnDef<(typeof data)[number]>[]}
        data={data}
        getRowId={(row) => `${row.kind}-${row.id}`}
        filters={[
          { id: 'sources', label: 'Filter by type', allLabel: 'All', options: FILTER_OPTIONS },
        ]}
        filterValues={{ sources: filter === 'all' ? '' : filter }}
        onApplyFilters={(values) => setUrlState({ sources: (values.sources || 'all') as Filter })}
        onClearFilters={() => setUrlState({ sources: 'all' })}
        toolbarActions={toolbarActions}
        rowActions={actions as RowAction<(typeof data)[number]>[]}
        emptyIcon={FileText}
        emptyTitle="Nothing matches this filter"
        emptyDescription="Try another filter to see more sources."
        pagination={{ page: 1, pageSize: Math.max(data.length, 1), total: data.length }}
      />

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
    </>
  );
}
