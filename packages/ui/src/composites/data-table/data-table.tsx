import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../uab/lib/format';
import { IconButton } from '../../uab/primitives/Button';
import { Icon } from '../../uab/primitives/Icon';
import { EmptyValue } from '../../uab/primitives/display';
import { Menu, type MenuItem } from '../../uab/primitives/overlay';
import { EmptyState } from '../EmptyState';
import { PageError } from '../PageError';
import { DateText } from '../DateText';
import { TableSkeleton } from '../TableSkeleton';
import type { DataTableColumnDef, DataTableProps, RowAction } from './data-table-types';
import { DataTablePagination } from './data-table-pagination';
import { DataTableToolbar } from './data-table-toolbar';

const DEFAULT_WIDTH = 150;
const SELECT_WIDTH = 40;
const ICON_SIZE = 30;
const MIN_COLUMN = 80;
const MAX_COLUMN = 520;
const DEFAULT_NOUN = { one: 'item', other: 'items' };

/** Width of the pinned Actions column: n icons of 30px, 2px gaps and 16px padding (never narrower than three, so the heading fits). */
const MIN_ACTION_ICONS = 3;
const actionsWidth = (icons: number): number => {
  const count = Math.max(MIN_ACTION_ICONS, icons);
  return count * ICON_SIZE + (count - 1) * 2 + 16;
};

const baseWidth = <TData,>(
  column: DataTableColumnDef<TData>,
  overrides: Record<string, number>,
): number =>
  overrides[column.id] ?? (typeof column.width === 'number' ? column.width : DEFAULT_WIDTH);

function readValue<TData>(column: DataTableColumnDef<TData>, row: TData): ReactNode {
  if (column.cell) return column.cell(row);
  const value = (row as Record<string, unknown>)[column.id];
  if (value === null || value === undefined || value === '') return <EmptyValue />;
  if (column.kind === 'date') return <DateText value={value as string | Date} />;
  return String(value);
}

interface RowActionsProps<TData> {
  row: TData;
  actions: RowAction<TData>[];
}

/** Icon buttons for the quick actions, then a "more" menu with the rest. */
function RowActionButtons<TData>({ row, actions }: RowActionsProps<TData>) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);
  const visible = actions.filter((action) => !action.hidden?.(row));
  const quick = visible.filter((action) => action.quick);
  const more = visible.filter((action) => !action.quick);
  const items: MenuItem[] = more.map((action, index) => ({
    id: action.key,
    label: typeof action.label === 'function' ? action.label(row) : action.label,
    icon: action.icon,
    danger: action.destructive,
    separatorBefore: action.destructive && index > 0,
    disabledReason: action.disabledReason?.(row),
    onSelect: () => action.onClick(row),
  }));

  return (
    <span className="uab-row-actions">
      {quick.map((action) => (
        <IconButton
          key={action.key}
          icon={action.icon ?? 'more'}
          label={typeof action.label === 'function' ? action.label(row) : action.label}
          disabledReason={action.disabledReason?.(row)}
          onClick={() => action.onClick(row)}
        />
      ))}
      {more.length > 0 && (
        <>
          <IconButton
            icon="more"
            label="More actions"
            aria-haspopup="menu"
            onClick={(event) => {
              anchor.current = event.currentTarget;
              setOpen(true);
            }}
          />
          <Menu
            open={open}
            onClose={() => setOpen(false)}
            anchor={anchor}
            label="Row actions"
            items={items}
          />
        </>
      )}
    </span>
  );
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  ariaLabel = 'Data table',
  noun = DEFAULT_NOUN,
  loading = false,
  error,
  emptyTitle = 'No results',
  emptyDescription = 'No data to display.',
  emptyIcon,
  emptyAction,
  search,
  filters,
  filterValues,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  hiddenColumns,
  onHiddenColumnsChange,
  sort,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  selectable = false,
  selected,
  onSelectionChange,
  bulkActions,
  toolbarActions,
  rowActions,
  onRowClick,
  activeRowId,
  rowClassName,
}: DataTableProps<TData>) {
  const [ownHidden, setOwnHidden] = useState<string[]>([]);
  const hidden = hiddenColumns ?? ownHidden;
  const setHidden = onHiddenColumnsChange ?? setOwnHidden;
  const [widthOverrides, setWidthOverrides] = useState<Record<string, number>>({});

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hidden.includes(column.id)),
    [columns, hidden],
  );
  const toolbarColumns = useMemo(
    () =>
      columns
        .filter((column) => column.canHide !== false)
        .map((column) => ({
          id: column.id,
          header: column.header,
          hidden: hidden.includes(column.id),
        })),
    [columns, hidden],
  );

  const rowId = useCallback(
    (row: TData, index: number): string => getRowId?.(row) ?? String(index),
    [getRowId],
  );
  const selection = selected ?? new Set<string>();
  const selectedCount = selection.size;

  const hasActions = Boolean(rowActions && rowActions.length > 0);
  const iconCount = useMemo(() => {
    if (!rowActions) return 0;
    const quick = rowActions.filter((action) => action.quick).length;
    const more = rowActions.some((action) => !action.quick) ? 1 : 0;
    return quick + more;
  }, [rowActions]);
  const ACTIONS_W = actionsWidth(iconCount);

  // Spare room is shared across the data columns in proportion to their width; Actions and the checkbox keep their size.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  const [moreRight, setMoreRight] = useState(false);
  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    setWrapWidth((width) => (Math.abs(width - el.clientWidth) > 1 ? el.clientWidth : width));
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure, visibleColumns, data.length]);

  const fixedWidth = (selectable ? SELECT_WIDTH : 0) + (hasActions ? ACTIONS_W : 0);
  const dataWidth = visibleColumns.reduce(
    (sum, column) => sum + baseWidth(column, widthOverrides),
    0,
  );
  const scale = wrapWidth && dataWidth ? Math.max(1, (wrapWidth - fixedWidth) / dataWidth) : 1;
  const widths = new Map(
    visibleColumns.map((column) => [
      column.id,
      Math.floor(baseWidth(column, widthOverrides) * scale),
    ]),
  );
  const lastColumn = visibleColumns[visibleColumns.length - 1];
  if (scale > 1 && lastColumn) {
    const used = [...widths.values()].reduce((a, b) => a + b, 0);
    widths.set(
      lastColumn.id,
      (widths.get(lastColumn.id) ?? 0) + Math.max(0, Math.floor(wrapWidth - fixedWidth - used)),
    );
  }

  const startResize = (id: string, startX: number, startWidth: number) => {
    const move = (event: PointerEvent) => {
      const next = Math.max(MIN_COLUMN, Math.min(MAX_COLUMN, startWidth + event.clientX - startX));
      setWidthOverrides((current) => ({ ...current, [id]: next }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const ids = data.map((row, index) => rowId(row, index));
  const allSelected = ids.length > 0 && ids.every((id) => selection.has(id));
  const someSelected = ids.some((id) => selection.has(id));
  const setSelection = (next: Set<string>) => onSelectionChange?.(next);
  const toggle = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  };

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const onRowKey = (event: ReactKeyboardEvent<HTMLTableRowElement>, row: TData, id: string) => {
    if (event.target !== event.currentTarget) return;
    const rows = Array.from(
      tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row]') ?? [],
    );
    const index = rows.indexOf(event.currentTarget);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      rows[index + 1]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      rows[index - 1]?.focus();
    } else if (event.key === 'Enter' && onRowClick) {
      event.preventDefault();
      onRowClick(row);
    } else if (event.key === ' ' && selectable) {
      event.preventDefault();
      toggle(id);
    }
  };

  const toolbar = (
    <DataTableToolbar
      search={search}
      filters={filters}
      filterValues={filterValues}
      onFilterChange={onFilterChange}
      onApplyFilters={onApplyFilters}
      onClearFilters={onClearFilters}
      columns={toolbarColumns}
      onToggleColumn={(id) =>
        setHidden(hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id])
      }
      onShowAllColumns={() => setHidden([])}
      selectedCount={selectedCount}
      bulkActions={bulkActions}
      toolbarActions={toolbarActions}
    />
  );
  // The tools line stays in every state so filters can always be changed or cleared.
  const withToolbar = (content: ReactNode) => (
    <>
      {toolbar}
      <div className="uab-content-surface">{content}</div>
    </>
  );

  if (loading) {
    return withToolbar(
      <TableSkeleton
        columns={visibleColumns.map(() => ({ kind: 'text' as const }))}
        rows={pagination?.pageSize ?? 10}
      />,
    );
  }
  if (error) return withToolbar(<PageError message={error.message} onRetry={error.onRetry} />);
  if (data.length === 0) {
    return withToolbar(
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />,
    );
  }

  return (
    <>
      {toolbar}
      <div className="uab-content-surface uab-is-table">
        <div
          ref={wrapRef}
          onScroll={measure}
          className={cx('uab-grid-wrap uab-density-compact', moreRight && 'uab-has-more-right')}
        >
          <table className="uab-grid" aria-label={ariaLabel} aria-rowcount={data.length}>
            <thead>
              <tr>
                {selectable && (
                  <th className="uab-col-select uab-sticky-left" style={{ left: 0 }} scope="col">
                    <input
                      type="checkbox"
                      aria-label="Select all rows on this page"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allSelected && someSelected;
                      }}
                      onChange={() => setSelection(allSelected ? new Set() : new Set(ids))}
                    />
                  </th>
                )}
                {visibleColumns.map((column) => {
                  const sortKey = column.sortKey ?? column.id;
                  const sorted = sort?.key === sortKey ? sort : null;
                  const width = widths.get(column.id) ?? DEFAULT_WIDTH;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      style={{ width, minWidth: width, maxWidth: width }}
                      className={cx(
                        sorted && 'uab-is-sorted',
                        column === lastColumn && 'uab-is-last',
                      )}
                      aria-sort={
                        sorted ? (sorted.order === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          className="uab-th-btn"
                          onClick={() =>
                            onSort?.({
                              key: sortKey,
                              order: sorted?.order === 'asc' ? 'desc' : 'asc',
                            })
                          }
                        >
                          <span className="uab-th-label">{column.header}</span>
                          <Icon
                            name={
                              sorted
                                ? sorted.order === 'asc'
                                  ? 'arrow-up'
                                  : 'arrow-down'
                                : 'chevrons-up-down'
                            }
                            size={12}
                            className={cx(!sorted && 'uab-th-sort-idle')}
                          />
                        </button>
                      ) : (
                        <span className="uab-th-label uab-th-static">{column.header}</span>
                      )}
                      <span
                        className="uab-col-resize"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${column.header} column`}
                        aria-valuenow={width}
                        tabIndex={0}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          startResize(column.id, event.clientX, baseWidth(column, widthOverrides));
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                          event.preventDefault();
                          const next = Math.max(
                            MIN_COLUMN,
                            Math.min(
                              MAX_COLUMN,
                              baseWidth(column, widthOverrides) +
                                (event.key === 'ArrowRight' ? 16 : -16),
                            ),
                          );
                          setWidthOverrides((current) => ({ ...current, [column.id]: next }));
                        }}
                      />
                    </th>
                  );
                })}
                {hasActions && (
                  <th
                    className="uab-col-actions uab-sticky-right"
                    scope="col"
                    style={{ width: ACTIONS_W, minWidth: ACTIONS_W, maxWidth: ACTIONS_W }}
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {data.map((row, index) => {
                const id = ids[index] ?? String(index);
                return (
                  <tr
                    key={id}
                    data-row
                    tabIndex={0}
                    className={cx(
                      selection.has(id) && 'uab-is-selected',
                      activeRowId === id && 'uab-is-active',
                      onRowClick && 'uab-is-clickable',
                      rowClassName?.(row),
                    )}
                    aria-selected={selectable ? selection.has(id) : undefined}
                    onKeyDown={(event) => onRowKey(event, row, id)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable && (
                      <td
                        className="uab-col-select uab-sticky-left"
                        style={{ left: 0 }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selection.has(id)}
                          onChange={() => toggle(id)}
                        />
                      </td>
                    )}
                    {visibleColumns.map((column) => {
                      const width = widths.get(column.id) ?? DEFAULT_WIDTH;
                      return (
                        <td
                          key={column.id}
                          style={{ width, minWidth: width, maxWidth: width }}
                          className={cx(
                            sort?.key === (column.sortKey ?? column.id) && 'uab-is-sorted',
                          )}
                        >
                          <span className="uab-cell">{readValue(column, row)}</span>
                        </td>
                      );
                    })}
                    {hasActions && rowActions && (
                      <td
                        className="uab-col-actions uab-sticky-right"
                        style={{ width: ACTIONS_W, minWidth: ACTIONS_W, maxWidth: ACTIONS_W }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RowActionButtons row={row} actions={rowActions} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pagination && (
          <DataTablePagination
            pagination={pagination}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            pageSizeOptions={pageSizeOptions}
            noun={noun}
          />
        )}
      </div>
    </>
  );
}
