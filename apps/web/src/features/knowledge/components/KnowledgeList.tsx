import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  DataTable,
  NoAccess,
  StatusBadge,
  type DataTableColumnDef,
  type DataTableFilterDef,
} from '@brd/ui';
import {
  KNOWLEDGE_STATUSES,
  knowledgeStatusSchema,
  type KnowledgeKind,
  type KnowledgeSourceDto,
  type KnowledgeStatus,
  type PagedResult,
} from '@brd/shared';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { useHiddenColumns } from '@/features/shell/hooks/use-hidden-columns';
import { useDocuments, useNotes } from '@/features/projects/hooks/use-sources';
import { KNOWLEDGE_PAGE_SIZE, useModuleOptions } from '../hooks/use-knowledge';
import type { useKnowledgeFilters } from '../hooks/use-knowledge-filters';
import { STATUS_LABELS, STATUS_TONES, needsAttention } from '../knowledge-labels';
import { SourceChunkDrawer } from './SourceChunkDrawer';

export interface KnowledgeRow {
  id: string;
  status: KnowledgeStatus;
  source: KnowledgeSourceDto;
}

interface KnowledgeListProps<T extends KnowledgeRow> {
  projectId: string;
  kind: KnowledgeKind;
  /** Plural, lower case: used in the empty and search texts. */
  noun: string;
  searchLabel: string;
  query: UseQueryResult<PagedResult<T>>;
  filterState: ReturnType<typeof useKnowledgeFilters>;
  columns: (openSource: (chunkId: string) => void) => DataTableColumnDef<T>[];
}

export function StatusCell({ row }: { row: KnowledgeRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge label={STATUS_LABELS[row.status]} tone={STATUS_TONES[row.status]} />
      {row.source.needsReview && <StatusBadge label="Source needs review" tone="warning" />}
    </div>
  );
}

const NEEDS_REVIEW = 'needs-review';

const STATUS_FILTER: DataTableFilterDef = {
  id: 'status',
  label: 'Filter by status',
  allLabel: 'All statuses',
  options: KNOWLEDGE_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
};

const REVIEW_FILTER: DataTableFilterDef = {
  id: 'review',
  label: 'Filter by review',
  allLabel: 'All items',
  options: [{ value: NEEDS_REVIEW, label: 'Needs review' }],
};

function useSourceFilter(projectId: string): DataTableFilterDef {
  const documents = useDocuments(projectId);
  const notes = useNotes(projectId);
  return useMemo(
    () => ({
      id: 'source',
      label: 'Filter by source',
      allLabel: 'All sources',
      options: [
        ...(documents.data?.items ?? []).map((d) => ({ value: d.id, label: d.title })),
        ...(notes.data?.items ?? []).map((n) => ({ value: n.id, label: `${n.title} (note)` })),
      ],
    }),
    [documents.data, notes.data],
  );
}

export function KnowledgeList<T extends KnowledgeRow>({
  projectId,
  kind,
  noun,
  searchLabel,
  query,
  filterState,
  columns,
}: KnowledgeListProps<T>) {
  const { filters, update, clear, activeCount } = filterState;
  const [hiddenColumns, setHiddenColumns] = useHiddenColumns(kind);
  const [openChunkId, setOpenChunkId] = useState<string | null>(null);
  const moduleOptions = useModuleOptions(projectId);
  const sourceFilter = useSourceFilter(projectId);

  const moduleFilter = useMemo<DataTableFilterDef[]>(
    () =>
      kind === 'modules'
        ? []
        : [
            {
              id: 'module',
              label: 'Filter by module',
              allLabel: 'All modules',
              options: (moduleOptions.data ?? []).map((m) => ({ value: m.id, label: m.name })),
            },
          ],
    [kind, moduleOptions.data],
  );

  if (query.isError && isForbidden(query.error)) {
    return <NoAccess description={`You do not have access to this project's ${noun}.`} />;
  }

  // Pressing Apply in the Filters panel sends every filter at once, as one change to the URL.
  const applyFilters = (values: Record<string, string>) => {
    const status = knowledgeStatusSchema.safeParse(values.status);
    update({
      status: status.success ? status.data : null,
      moduleId: values.module || null,
      sourceId: values.source || null,
      needsReview: values.review === NEEDS_REVIEW,
    });
  };

  const result = query.data;
  return (
    <>
      <DataTable<T>
        columns={columns(setOpenChunkId)}
        data={result?.items ?? []}
        getRowId={(row) => row.id}
        loading={query.isPending}
        error={
          query.isError
            ? { message: errorMessage(query.error), onRetry: () => void query.refetch() }
            : null
        }
        search={{
          value: filters.search,
          onChange: (search) => update({ search }),
          placeholder: searchLabel,
          ariaLabel: searchLabel,
        }}
        filters={[STATUS_FILTER, ...moduleFilter, sourceFilter, REVIEW_FILTER]}
        filterValues={{
          status: filters.status ?? '',
          module: filters.moduleId ?? '',
          source: filters.sourceId ?? '',
          review: filters.needsReview ? NEEDS_REVIEW : '',
        }}
        onApplyFilters={applyFilters}
        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={setHiddenColumns}
        onClearFilters={clear}
        rowClassName={(row) => (needsAttention(row) ? 'row-attention' : undefined)}
        emptyIcon={SearchX}
        emptyTitle={activeCount > 0 ? `No matching ${noun}` : `No ${noun} yet`}
        emptyDescription={
          activeCount > 0
            ? 'Nothing matches these filters. Change or clear them to see more.'
            : `${noun.charAt(0).toUpperCase()}${noun.slice(1)} appear here once your sources have been processed.`
        }
        pagination={
          result
            ? { page: result.page, pageSize: KNOWLEDGE_PAGE_SIZE, total: result.total }
            : undefined
        }
        onPageChange={(page) => update({ page })}
      />
      <SourceChunkDrawer
        projectId={projectId}
        chunkId={openChunkId}
        onClose={() => setOpenChunkId(null)}
      />
    </>
  );
}
