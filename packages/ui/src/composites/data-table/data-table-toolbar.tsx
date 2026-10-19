import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../uab/lib/format';
import { Button } from '../../uab/primitives/Button';
import { SelectMenu } from '../../uab/primitives/SelectMenu';
import { Popover } from '../../uab/primitives/overlay';
import type {
  DataTableFilterDef,
  DataTableFilterValues,
  DataTableSearch,
} from './data-table-types';

export interface ToolbarColumn {
  id: string;
  header: string;
  hidden: boolean;
}

interface DataTableToolbarProps {
  search?: DataTableSearch;
  filters?: DataTableFilterDef[];
  filterValues?: DataTableFilterValues;
  onFilterChange?: (id: string, value: string) => void;
  onApplyFilters?: (values: DataTableFilterValues) => void;
  onClearFilters?: () => void;
  columns?: ToolbarColumn[];
  onToggleColumn?: (id: string) => void;
  onShowAllColumns?: () => void;
  /** Overrides the dot on Filters when a page's defaults are not "no filter" (e.g. Open by default). */
  filtersActive?: boolean;
  selectedCount?: number;
  bulkActions?: ReactNode;
  toolbarActions?: ReactNode;
}

const SEGMENTED_MAX_OPTIONS = 3;
const SEARCH_DEBOUNCE_MS = 300;

/** "Filter by status" reads as "Status" above its control. */
const filterTitle = (filter: DataTableFilterDef): string => {
  const title = filter.label.replace(/^filter by\s+/i, '');
  return title.charAt(0).toUpperCase() + title.slice(1);
};

function SearchIcon() {
  return (
    <span className="uab-search-icon" aria-hidden="true">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </span>
  );
}

/** The search box: the page learns of a change 300ms after the person stops typing. */
function SearchField({ search }: { search: DataTableSearch }) {
  const [text, setText] = useState(search.value);
  const lastSent = useRef(search.value);
  const onChange = useRef(search.onChange);
  onChange.current = search.onChange;

  useEffect(() => {
    if (search.value !== lastSent.current) {
      lastSent.current = search.value;
      setText(search.value);
    }
  }, [search.value]);

  useEffect(() => {
    if (text === lastSent.current) return undefined;
    const timer = setTimeout(() => {
      lastSent.current = text;
      onChange.current(text);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div className="uab-search-field">
      <SearchIcon />
      <input
        type="search"
        className="uab-input uab-input-compact"
        placeholder={search.placeholder ?? 'Search'}
        aria-label={search.ariaLabel ?? search.placeholder ?? 'Search'}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}

/** Line 2: search · Filters · Columns on the left; the selection and its bulk actions at the right. */
export function DataTableToolbar({
  search,
  filters = [],
  filterValues = {},
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  columns = [],
  onToggleColumn,
  onShowAllColumns,
  selectedCount = 0,
  bulkActions,
  toolbarActions,
  filtersActive: filtersActiveProp,
}: DataTableToolbarProps) {
  const hasFilters = filters.length > 0;
  const hasColumns = columns.length > 0 && onToggleColumn !== undefined;
  if (!search && !hasFilters && !hasColumns && !toolbarActions && selectedCount === 0) return null;

  const filtersActive =
    filtersActiveProp ?? filters.some((filter) => (filterValues[filter.id] ?? '') !== '');

  return (
    <div className="uab-view-tools uab-view-tools-row">
      {search && <SearchField search={search} />}
      {hasFilters && (
        <FiltersMenu
          filters={filters}
          values={filterValues}
          active={filtersActive}
          onChange={onFilterChange}
          onApply={onApplyFilters}
          onClear={onClearFilters}
        />
      )}
      {hasColumns && (
        <ColumnsMenu columns={columns} onToggle={onToggleColumn} onShowAll={onShowAllColumns} />
      )}
      <span className="uab-spacer" />
      {selectedCount === 0 && toolbarActions}
      {selectedCount > 0 && (
        <>
          <span className="uab-viewbar-divider" aria-hidden="true" />
          <div className="uab-bulk-tools" role="region" aria-label="Bulk actions">
            <strong className="uab-bulk-count">{selectedCount} selected</strong>
            {bulkActions}
          </div>
        </>
      )}
    </div>
  );
}

interface FiltersMenuProps {
  filters: DataTableFilterDef[];
  values: DataTableFilterValues;
  active: boolean;
  onChange?: (id: string, value: string) => void;
  onApply?: (values: DataTableFilterValues) => void;
  onClear?: () => void;
}

function FiltersMenu({ filters, values, active, onChange, onApply, onClear }: FiltersMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DataTableFilterValues>(values);
  const ref = useRef<HTMLButtonElement>(null);

  const openPanel = () => {
    setDraft(values);
    setOpen(true);
  };
  const close = () => setOpen(false);

  const apply = () => {
    if (onApply) onApply(draft);
    else
      filters.forEach((filter) => {
        const next = draft[filter.id] ?? '';
        if (next !== (values[filter.id] ?? '')) onChange?.(filter.id, next);
      });
    close();
  };

  return (
    <>
      <Button
        ref={ref}
        icon="sliders"
        iconRight={open ? 'chevron-up' : 'chevron-down'}
        onClick={() => (open ? close() : openPanel())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={active ? 'Filters, applied' : 'Filters'}
        className={cx(open && 'uab-is-open')}
      >
        Filters
        {active && <span className="uab-btn-dot" aria-hidden="true" />}
      </Button>
      <Popover
        open={open}
        onClose={close}
        anchor={ref}
        label="Filters"
        width={320}
        className="uab-filter-pop"
        align="end"
      >
        <div className="uab-qf">
          {filters.map((filter) => {
            const title = filterTitle(filter);
            const value = draft[filter.id] ?? '';
            const allLabel = filter.allLabel ?? 'All';
            return (
              <div key={filter.id} className="uab-qf-field">
                <span className="uab-qf-label" id={`qf-${filter.id}`}>
                  {title}
                </span>
                {filter.options.length <= SEGMENTED_MAX_OPTIONS ? (
                  <div
                    className="uab-segmented uab-qf-seg"
                    role="radiogroup"
                    aria-labelledby={`qf-${filter.id}`}
                  >
                    {[{ value: '', label: 'All' }, ...filter.options].map((option) => (
                      <button
                        key={option.value || 'all'}
                        type="button"
                        role="radio"
                        aria-checked={value === option.value}
                        className={cx('uab-seg-btn', value === option.value && 'uab-is-on')}
                        onClick={() =>
                          setDraft((current) => ({ ...current, [filter.id]: option.value }))
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <SelectMenu
                    block
                    label={filter.label}
                    placeholder={allLabel}
                    value={value}
                    options={[{ value: '', label: allLabel }, ...filter.options]}
                    onChange={(next) => setDraft((current) => ({ ...current, [filter.id]: next }))}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="uab-qf-foot">
          <Button
            variant="ghost"
            onClick={() => {
              onClear?.();
              close();
            }}
          >
            Clear
          </Button>
          <Button variant="primary" onClick={apply}>
            Apply
          </Button>
        </div>
      </Popover>
    </>
  );
}

interface ColumnsMenuProps {
  columns: ToolbarColumn[];
  onToggle: (id: string) => void;
  onShowAll?: () => void;
}

function ColumnsMenu({ columns, onToggle, onShowAll }: ColumnsMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLButtonElement>(null);
  const shown = columns.filter((column) =>
    column.header.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <Button
        ref={ref}
        icon="columns"
        iconRight={open ? 'chevron-up' : 'chevron-down'}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cx(open && 'uab-is-open')}
      >
        Columns
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={ref}
        label="Column manager"
        width={320}
        align="end"
      >
        <div className="uab-pop-head">
          <strong>Columns</strong>
          {onShowAll && (
            <Button
              variant="ghost"
              icon="reset"
              onClick={onShowAll}
              disabledReason={
                columns.some((column) => column.hidden) ? undefined : 'All columns are shown'
              }
            >
              Reset
            </Button>
          )}
        </div>
        <input
          className="uab-input uab-input-compact"
          placeholder="Search fields"
          aria-label="Search fields"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          data-autofocus
        />
        <ul className="uab-col-list" aria-label="Columns">
          {shown.map((column) => (
            <li key={column.id} className="uab-col-item">
              <label className="uab-check">
                <input
                  type="checkbox"
                  checked={!column.hidden}
                  onChange={() => onToggle(column.id)}
                />
                {column.header}
              </label>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
