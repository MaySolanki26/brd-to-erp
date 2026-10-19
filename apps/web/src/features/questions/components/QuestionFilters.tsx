import {
  QUESTION_PRIORITIES,
  QUESTION_REASONS,
  QUESTION_STATUSES,
  type QuestionPriority,
  type QuestionReason,
  type QuestionStatus,
} from '@brd/shared';
import { DataTableToolbar, type DataTableFilterDef, type DataTableFilterValues } from '@brd/ui';
import type { QuestionFilters as Filters } from '../hooks/use-question-filters';
import { PRIORITY_LABELS, QUESTION_STATUS_LABELS, REASON_LABELS } from '../question-labels';

const FILTERS: DataTableFilterDef[] = [
  {
    id: 'status',
    label: 'Filter by status',
    allLabel: 'All statuses',
    options: QUESTION_STATUSES.map((value) => ({ value, label: QUESTION_STATUS_LABELS[value] })),
  },
  {
    id: 'reason',
    label: 'Filter by reason',
    allLabel: 'All reasons',
    options: QUESTION_REASONS.map((value) => ({ value, label: REASON_LABELS[value] })),
  },
  {
    id: 'priority',
    label: 'Filter by priority',
    allLabel: 'All priorities',
    options: QUESTION_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] })),
  },
];

interface QuestionFiltersProps {
  filters: Filters;
  activeCount: number;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  /** Counts shown at the right end of the tools line, e.g. "332 open · 1 critical". */
  summary?: string;
}

/** The questions tools line: one Filters panel (status, reason, priority) with Apply and Clear. */
export function QuestionFilters({
  filters,
  activeCount,
  onChange,
  onReset,
  summary,
}: QuestionFiltersProps) {
  const values: DataTableFilterValues = {
    status: filters.status ?? '',
    reason: filters.reason ?? '',
    priority: filters.priority ?? '',
  };

  return (
    <DataTableToolbar
      filters={FILTERS}
      filterValues={values}
      filtersActive={activeCount > 0}
      onApplyFilters={(next) =>
        onChange({
          status: (next.status || null) as QuestionStatus | null,
          reason: (next.reason || null) as QuestionReason | null,
          priority: (next.priority || null) as QuestionPriority | null,
        })
      }
      onClearFilters={onReset}
      toolbarActions={
        summary ? <span className="uab-toolbar-count uab-muted">{summary}</span> : undefined
      }
    />
  );
}
