import { useMemo, useCallback } from 'react';
import {
  useLegacyTable,
  getCoreRowModel,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy';
import { flexRender, type RowSelectionState, type RowData } from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../table';
import { TableSkeleton } from '../TableSkeleton';
import { PageError } from '../PageError';
import { EmptyState } from '../EmptyState';
import type { DataTableProps, DataTableColumnDef } from './data-table-types';
import { DataTableSortHeader } from './data-table-header';
import { createSelectionColumn } from './data-table-selection';
import { DataTableRowActions } from './data-table-actions';
import { DataTablePagination } from './data-table-pagination';

function buildColumns<TData extends RowData>(
  columns: DataTableColumnDef<TData>[],
  props: Pick<DataTableProps<TData>, 'selectable' | 'rowActions' | 'sort' | 'onSort'>,
): LegacyColumnDef<TData>[] {
  const result: LegacyColumnDef<TData>[] = [];

  if (props.selectable) {
    result.push(createSelectionColumn<TData>());
  }

  for (const col of columns) {
    result.push({
      id: col.id,
      accessorFn: col.cell ? undefined : (row: TData) => (row as Record<string, unknown>)[col.id],
      header: col.sortable
        ? () => (
            <DataTableSortHeader
              label={col.header}
              sortKey={col.sortKey ?? col.id}
              sort={props.sort}
              onSort={props.onSort}
              align={col.align}
            />
          )
        : () => (
            <span
              className={cn(
                'text-lg font-medium',
                col.align === 'right' && 'ml-auto',
                col.align === 'center' && 'mx-auto',
              )}
            >
              {col.header}
            </span>
          ),
      cell: col.cell
        ? ({ row }) => col.cell!(row.original)
        : ({ getValue }) => {
            const val = getValue();
            return val != null ? String(val) : '';
          },
      size: typeof col.width === 'number' ? col.width : undefined,
      meta: { align: col.align, width: col.width },
    });
  }

  if (props.rowActions && props.rowActions.length > 0) {
    const actions = props.rowActions;
    result.push({
      id: '__actions',
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DataTableRowActions row={row.original} actions={actions} />
        </div>
      ),
      size: 48,
      enableSorting: false,
    });
  }

  return result;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  loading = false,
  error,
  emptyTitle = 'No results',
  emptyDescription = 'No data to display.',
  emptyIcon,
  emptyAction,
  sort,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  selectable = false,
  selected,
  onSelectionChange,
  rowActions,
  onRowClick,
  rowClassName,
  className,
  stickyHeader = false,
  compact = false,
}: DataTableProps<TData>) {
  // Convert external Set<string> to tanstack RowSelectionState
  const rowSelection: RowSelectionState = useMemo(() => {
    if (!selected) return {};
    const state: RowSelectionState = {};
    for (const id of selected) {
      state[id] = true;
    }
    return state;
  }, [selected]);

  const onRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => {
      if (!onSelectionChange) return;
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onSelectionChange(new Set(Object.keys(next).filter((k) => next[k])));
    },
    [onSelectionChange, rowSelection],
  );

  const tanstackColumns = useMemo(
    () => buildColumns(columns, { selectable, rowActions, sort, onSort }),
    [columns, selectable, rowActions, sort, onSort],
  );

  const table = useLegacyTable({
    data,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId,
    state: { rowSelection },
    onRowSelectionChange,
    enableRowSelection: selectable,
  });

  // Loading state
  if (loading) {
    const skeletonCols = columns.map(() => ({ kind: 'text' as const }));
    return <TableSkeleton columns={skeletonCols} rows={pagination?.pageSize ?? 10} />;
  }

  // Error state
  if (error) {
    return <PageError message={error.message} onRetry={error.onRetry} />;
  }

  // Empty state
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />
    );
  }

  const selectedCount = selected?.size ?? 0;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className={cn(stickyHeader && 'sticky top-0 z-10 bg-surface')}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    { align?: string; width?: number | string } | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(compact && 'py-1.5')}
                      style={meta?.width ? { width: meta.width } : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  rowClassName?.(row.original as TData),
                )}
                onClick={onRowClick ? () => onRowClick(row.original as TData) : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { align?: string } | undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        compact && 'py-1.5',
                        meta?.align === 'right' && 'text-right',
                        meta?.align === 'center' && 'text-center',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <DataTablePagination
          pagination={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
          selectedCount={selectedCount}
        />
      )}
    </div>
  );
}
