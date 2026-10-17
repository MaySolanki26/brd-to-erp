import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button, DataTable, NoAccess, StatusBadge, type DataTableColumnDef } from '@brd/ui';
import type { KnowledgeKind, KnowledgeSourceDto, KnowledgeStatus, PagedResult } from '@brd/shared';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { useDocuments, useNotes } from '@/features/projects/hooks/use-sources';
import { KNOWLEDGE_PAGE_SIZE, useModuleOptions } from '../hooks/use-knowledge';
import type { useKnowledgeFilters } from '../hooks/use-knowledge-filters';
import { STATUS_LABELS, STATUS_TONES, needsAttention } from '../knowledge-labels';
import { KnowledgeToolbar, type FilterOption } from './KnowledgeToolbar';
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

function useSourceOptions(projectId: string): FilterOption[] {
  const documents = useDocuments(projectId);
  const notes = useNotes(projectId);
  return useMemo(
    () => [
      ...(documents.data?.items ?? []).map((d) => ({ id: d.id, label: d.title })),
      ...(notes.data?.items ?? []).map((n) => ({ id: n.id, label: `${n.title} (note)` })),
    ],
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
  const [openChunkId, setOpenChunkId] = useState<string | null>(null);
  const moduleOptions = useModuleOptions(projectId);
  const sources = useSourceOptions(projectId);
  const modules =
    kind === 'modules'
      ? undefined
      : (moduleOptions.data ?? []).map((m) => ({ id: m.id, label: m.name }));

  if (query.isError && isForbidden(query.error)) {
    return <NoAccess description={`You do not have access to this project's ${noun}.`} />;
  }

  const result = query.data;
  return (
    <div>
      <KnowledgeToolbar
        filters={filters}
        onChange={update}
        onClear={clear}
        activeCount={activeCount}
        searchLabel={searchLabel}
        modules={modules}
        sources={sources}
      />
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
        rowClassName={(row) => (needsAttention(row) ? 'row-attention' : undefined)}
        emptyIcon={SearchX}
        emptyTitle={activeCount > 0 ? `No matching ${noun}` : `No ${noun} yet`}
        emptyDescription={
          activeCount > 0
            ? 'Nothing matches these filters. Change or clear them to see more.'
            : `${noun.charAt(0).toUpperCase()}${noun.slice(1)} appear here once your sources have been processed.`
        }
        emptyAction={
          activeCount > 0 ? (
            <Button variant="outline" size="sm" onClick={clear}>
              Clear filters
            </Button>
          ) : undefined
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
    </div>
  );
}
