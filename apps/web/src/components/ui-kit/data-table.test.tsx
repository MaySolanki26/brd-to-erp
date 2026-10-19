import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableColumnDef } from '@brd/ui';

interface Row {
  id: string;
  name: string;
}

const COLUMNS: DataTableColumnDef<Row>[] = [{ id: 'name', header: 'Name', sortable: true }];
const ROWS: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];

describe('DataTable', () => {
  it('shows rows and reports a sort click as ascending first', async () => {
    const onSort = vi.fn();
    render(<DataTable columns={COLUMNS} data={ROWS} getRowId={(r) => r.id} onSort={onSort} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith({ key: 'name', order: 'asc' });
  });

  it('reports page changes from server pagination', async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        pagination={{ page: 1, pageSize: 2, total: 6 }}
        onPageChange={onPageChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('keeps search and the Filters panel when no rows match, and clears from the panel', async () => {
    const onClear = vi.fn();
    const onSearch = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        emptyTitle="No matches"
        search={{ value: 'zzz', onChange: onSearch, placeholder: 'Search names' }}
        filters={[{ id: 'status', label: 'Status', options: [{ value: 'OPEN', label: 'Open' }] }]}
        filterValues={{ status: 'OPEN' }}
        onFilterChange={vi.fn()}
        onClearFilters={onClear}
      />,
    );
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search names' })).toHaveValue('zzz');

    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows the retry action on error and a skeleton while loading', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DataTable columns={COLUMNS} data={[]} error={{ message: 'Boom', onRetry }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();

    rerender(<DataTable columns={COLUMNS} data={[]} loading />);
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
  });
});
