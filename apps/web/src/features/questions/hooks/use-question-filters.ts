import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  questionPrioritySchema,
  questionReasonSchema,
  questionStatusSchema,
  type QuestionPriority,
  type QuestionReason,
  type QuestionStatus,
} from '@brd/shared';

export interface QuestionFilters {
  /** Null means every status. */
  status: QuestionStatus | null;
  reason: QuestionReason | null;
  priority: QuestionPriority | null;
}

export const DEFAULT_QUESTION_FILTERS: QuestionFilters = {
  status: 'OPEN',
  reason: null,
  priority: null,
};

const PREFIX = 'questions';
const ALL_STATUSES = 'all';
const FIELDS = ['status', 'reason', 'priority'] as const;

/** Writes filters into URL params; values equal to the default are left out. */
export function applyQuestionFilters(
  params: URLSearchParams,
  patch: Partial<QuestionFilters>,
): void {
  if ('status' in patch) {
    const status = patch.status ?? null;
    if (status === DEFAULT_QUESTION_FILTERS.status) params.delete(`${PREFIX}.status`);
    else params.set(`${PREFIX}.status`, status ?? ALL_STATUSES);
  }
  for (const field of ['reason', 'priority'] as const) {
    if (!(field in patch)) continue;
    const value = patch[field] ?? null;
    if (value === null) params.delete(`${PREFIX}.${field}`);
    else params.set(`${PREFIX}.${field}`, value);
  }
}

export function clearQuestionFilters(params: URLSearchParams): void {
  for (const field of FIELDS) params.delete(`${PREFIX}.${field}`);
}

/**
 * Filters live in the URL so a filtered view can be shared or reloaded. Anything that does not
 * parse falls back to the default.
 */
export function useQuestionFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<QuestionFilters>(() => {
    const rawStatus = params.get(`${PREFIX}.status`);
    const status = questionStatusSchema.safeParse(rawStatus);
    const reason = questionReasonSchema.safeParse(params.get(`${PREFIX}.reason`));
    const priority = questionPrioritySchema.safeParse(params.get(`${PREFIX}.priority`));
    return {
      status:
        rawStatus === ALL_STATUSES
          ? null
          : status.success
            ? status.data
            : DEFAULT_QUESTION_FILTERS.status,
      reason: reason.success ? reason.data : null,
      priority: priority.success ? priority.data : null,
    };
  }, [params]);

  const change = useCallback(
    (patch: Partial<QuestionFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          applyQuestionFilters(next, patch);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        clearQuestionFilters(next);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  /** Filters that differ from what a person sees when they first open the tab. */
  const activeCount = [
    filters.status !== DEFAULT_QUESTION_FILTERS.status,
    filters.reason !== null,
    filters.priority !== null,
  ].filter(Boolean).length;

  return { filters, change, reset, activeCount };
}
