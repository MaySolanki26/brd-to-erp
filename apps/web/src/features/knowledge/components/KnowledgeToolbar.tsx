import { X } from 'lucide-react';
import {
  Button,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@brd/ui';
import { KNOWLEDGE_STATUSES, type KnowledgeStatus } from '@brd/shared';
import { STATUS_LABELS } from '../knowledge-labels';
import type { KnowledgeFilters } from '../hooks/use-knowledge-filters';

const ALL = 'all';

export interface FilterOption {
  id: string;
  label: string;
}

interface KnowledgeToolbarProps {
  filters: KnowledgeFilters;
  onChange: (patch: Partial<KnowledgeFilters>) => void;
  onClear: () => void;
  activeCount: number;
  searchLabel: string;
  /** Omit to hide the module filter (the Modules tab filters modules themselves). */
  modules?: FilterOption[];
  sources: FilterOption[];
}

interface FilterSelectProps {
  label: string;
  allLabel: string;
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
}

function FilterSelect({ label, allLabel, value, options, onChange }: FilterSelectProps) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const STATUS_OPTIONS: FilterOption[] = KNOWLEDGE_STATUSES.map((status) => ({
  id: status,
  label: STATUS_LABELS[status],
}));

export function KnowledgeToolbar({
  filters,
  onChange,
  onClear,
  activeCount,
  searchLabel,
  modules,
  sources,
}: KnowledgeToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchInput
        value={filters.search}
        onChange={(search) => onChange({ search })}
        placeholder={searchLabel}
        aria-label={searchLabel}
        className="w-64"
      />
      <FilterSelect
        label="Filter by status"
        allLabel="All statuses"
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onChange({ status: status as KnowledgeStatus | null })}
      />
      {modules && (
        <FilterSelect
          label="Filter by module"
          allLabel="All modules"
          value={filters.moduleId}
          options={modules.map((m) => ({ id: m.id, label: m.label }))}
          onChange={(moduleId) => onChange({ moduleId })}
        />
      )}
      <FilterSelect
        label="Filter by source"
        allLabel="All sources"
        value={filters.sourceId}
        options={sources}
        onChange={(sourceId) => onChange({ sourceId })}
      />
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" aria-hidden />
          Clear filters
        </Button>
      )}
    </div>
  );
}
