import { X } from 'lucide-react';
import { Button } from '../../button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../select';
import { SearchInput } from '../SearchInput';
import type { DataTableFilterDef, DataTableFilterValues, DataTableSearch } from './data-table-types';

const ALL_VALUE = '__all__';

interface DataTableToolbarProps {
  search?: DataTableSearch;
  filters?: DataTableFilterDef[];
  filterValues?: DataTableFilterValues;
  onFilterChange?: (id: string, value: string) => void;
  onClearFilters?: () => void;
}

export function DataTableToolbar({
  search,
  filters,
  filterValues = {},
  onFilterChange,
  onClearFilters,
}: DataTableToolbarProps) {
  const activeCount = filters?.filter((filter) => (filterValues[filter.id] ?? '') !== '').length ?? 0;

  if (!search && (!filters || filters.length === 0)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      {search && (
        <SearchInput
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
          aria-label={search.ariaLabel ?? search.placeholder ?? 'Search'}
          className="w-64"
        />
      )}
      {filters?.map((filter) => (
        <Select
          key={filter.id}
          value={filterValues[filter.id] || ALL_VALUE}
          onValueChange={(value) => onFilterChange?.(filter.id, value === ALL_VALUE ? '' : value)}
        >
          <SelectTrigger className="h-8 w-40" aria-label={filter.label}>
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All {filter.label.toLowerCase()}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {activeCount > 0 && onClearFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
