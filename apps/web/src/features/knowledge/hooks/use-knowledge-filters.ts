import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  knowledgeStatusSchema,
  uuidSchema,
  type KnowledgeKind,
  type KnowledgeStatus,
} from '@brd/shared';

export interface KnowledgeFilters {
  status: KnowledgeStatus | null;
  moduleId: string | null;
  sourceId: string | null;
  search: string;
  page: number;
}

type FilterPatch = Partial<KnowledgeFilters>;

const FIELDS = ['status', 'module', 'source', 'q', 'page'] as const;

/**
 * Filters live in the URL, namespaced per tab (e.g. `requirements.status`), so a filtered view can be
 * shared or reloaded and each tab keeps its own.
 */
export function useKnowledgeFilters(kind: KnowledgeKind) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<KnowledgeFilters>(() => {
    const status = knowledgeStatusSchema.safeParse(params.get(`${kind}.status`));
    const moduleId = uuidSchema.safeParse(params.get(`${kind}.module`));
    const sourceId = uuidSchema.safeParse(params.get(`${kind}.source`));
    const page = Number.parseInt(params.get(`${kind}.page`) ?? '1', 10);
    return {
      status: status.success ? status.data : null,
      moduleId: moduleId.success ? moduleId.data : null,
      sourceId: sourceId.success ? sourceId.data : null,
      search: params.get(`${kind}.q`)?.trim() ?? '',
      page: Number.isInteger(page) && page >= 1 ? page : 1,
    };
  }, [params, kind]);

  const update = useCallback(
    (patch: FilterPatch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const set = (field: (typeof FIELDS)[number], value: string | number | null) => {
            const name = `${kind}.${field}`;
            if (value === null || value === '' || value === 1) next.delete(name);
            else next.set(name, String(value));
          };
          if ('status' in patch) set('status', patch.status ?? null);
          if ('moduleId' in patch) set('module', patch.moduleId ?? null);
          if ('sourceId' in patch) set('source', patch.sourceId ?? null);
          if ('search' in patch) set('q', patch.search?.trim() ?? null);
          // Any filter change starts again from the first page.
          set('page', 'page' in patch ? (patch.page ?? 1) : 1);
          return next;
        },
        { replace: true },
      );
    },
    [kind, setParams],
  );

  const clear = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const field of FIELDS) next.delete(`${kind}.${field}`);
        return next;
      },
      { replace: true },
    );
  }, [kind, setParams]);

  const activeCount = [filters.status, filters.moduleId, filters.sourceId, filters.search].filter(
    Boolean,
  ).length;

  return { filters, update, clear, activeCount };
}
