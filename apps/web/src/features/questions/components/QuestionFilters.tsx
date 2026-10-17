import { X } from 'lucide-react';
import {
  QUESTION_PRIORITIES,
  QUESTION_REASONS,
  QUESTION_STATUSES,
  type QuestionPriority,
  type QuestionReason,
  type QuestionStatus,
} from '@brd/shared';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@brd/ui';
import type { QuestionFilters as Filters } from '../hooks/use-question-filters';
import { PRIORITY_LABELS, QUESTION_STATUS_LABELS, REASON_LABELS } from '../question-labels';

const ALL = 'all';

interface FilterSelectProps<T extends string> {
  label: string;
  allLabel: string;
  value: T | null;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T | null) => void;
}

function FilterSelect<T extends string>({
  label,
  allLabel,
  value,
  options,
  labels,
  onChange,
}: FilterSelectProps<T>) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? null : (next as T))}
    >
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface QuestionFiltersProps {
  filters: Filters;
  activeCount: number;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

export function QuestionFilters({ filters, activeCount, onChange, onReset }: QuestionFiltersProps) {
  return (
    <div role="group" aria-label="Filter questions" className="flex flex-wrap items-center gap-2">
      <FilterSelect<QuestionStatus>
        label="Filter by status"
        allLabel="All statuses"
        value={filters.status}
        options={QUESTION_STATUSES}
        labels={QUESTION_STATUS_LABELS}
        onChange={(status) => onChange({ status })}
      />
      <FilterSelect<QuestionReason>
        label="Filter by reason"
        allLabel="All reasons"
        value={filters.reason}
        options={QUESTION_REASONS}
        labels={REASON_LABELS}
        onChange={(reason) => onChange({ reason })}
      />
      <FilterSelect<QuestionPriority>
        label="Filter by priority"
        allLabel="All priorities"
        value={filters.priority}
        options={QUESTION_PRIORITIES}
        labels={PRIORITY_LABELS}
        onChange={(priority) => onChange({ priority })}
      />
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="mr-1 h-3 w-3" />
          Reset filters
        </Button>
      )}
    </div>
  );
}
