import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, DataTablePagination, type DataTableColumnDef } from '@brd/ui';

interface Row {
  id: string;
  name: string;
  owner: string | null;
  created: string;
}

const COLUMNS: DataTableColumnDef<Row>[] = [
  { id: 'name', header: 'Name', canHide: false },
  { id: 'owner', header: 'Owner' },
  { id: 'created', header: 'Created', kind: 'date' },
];

const ROWS: Row[] = [
  { id: '1', name: 'Alpha', owner: 'Ana', created: '2026-10-16' },
  { id: '2', name: 'Beta', owner: null, created: '2026-10-17' },
];

const FEW = [{ value: 'OPEN', label: 'Open' }];
const MANY = Array.from({ length: 5 }, (_, i) => ({ value: `m${i}`, label: `Module ${i}` }));

describe('DataTable cells', () => {
  it('shows dates as 16 Oct, 2026 and a missing value as N/A', () => {
    render(<DataTable columns={COLUMNS} data={ROWS} getRowId={(r) => r.id} />);
    expect(screen.getByText('16 Oct, 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Not available')).toBeInTheDocument();
  });

  it('left-aligns every column even when a right alignment is asked for', () => {
    render(
      <DataTable
        columns={[{ id: 'name', header: 'Name', align: 'right' }]}
        data={ROWS}
        getRowId={(r) => r.id}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /^Name/ })).not.toHaveClass('uab-align-right');
    expect(screen.getByRole('cell', { name: 'Alpha' })).not.toHaveClass('uab-align-right');
  });

  it('marks the sorted column as sorted for assistive technology', () => {
    render(
      <DataTable
        columns={[{ id: 'name', header: 'Name', sortable: true }]}
        data={ROWS}
        getRowId={(r) => r.id}
        sort={{ key: 'name', order: 'desc' }}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /^Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
});

describe('Filters panel', () => {
  it('shows an accent dot, not a count, when filters apply', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        filters={[{ id: 'status', label: 'Filter by status', options: FEW }]}
        filterValues={{ status: 'OPEN' }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Filters, applied' });
    expect(button).not.toHaveTextContent(/\d/);
  });

  it('changes nothing until Apply, then reports every changed filter', async () => {
    const onFilterChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        filters={[
          { id: 'status', label: 'Filter by status', options: FEW },
          { id: 'module', label: 'Filter by module', allLabel: 'All modules', options: MANY },
        ]}
        filterValues={{}}
        onFilterChange={onFilterChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    // Few values: a segmented control that starts on All.
    const status = screen.getByRole('radiogroup', { name: 'Status' });
    expect(within(status).getByRole('radio', { name: 'All' })).toBeChecked();
    await userEvent.click(within(status).getByRole('radio', { name: 'Open' }));
    expect(onFilterChange).not.toHaveBeenCalled();

    // Several values: a dropdown that defaults to the All wording.
    expect(
      screen.getByRole('button', { name: 'Filter by module: All modules' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith('status', 'OPEN');
  });

  it('sends all filters at once when the page handles Apply itself', async () => {
    const onApplyFilters = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        filters={[{ id: 'status', label: 'Filter by status', options: FEW }]}
        filterValues={{}}
        onApplyFilters={onApplyFilters}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApplyFilters).toHaveBeenCalledWith({ status: 'OPEN' });
  });
});

describe('Columns menu', () => {
  it('hides and shows columns, never offers a column that cannot be hidden, and shows all again', async () => {
    const onHidden = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        hiddenColumns={[]}
        onHiddenColumnsChange={onHidden}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Columns/ }));
    const list = screen.getByRole('list', { name: 'Columns' });
    expect(within(list).queryByText('Name')).not.toBeInTheDocument();
    await userEvent.click(within(list).getByRole('checkbox', { name: 'Owner' }));
    expect(onHidden).toHaveBeenCalledWith(['owner']);
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));

    rerender(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        hiddenColumns={['owner']}
        onHiddenColumnsChange={onHidden}
      />,
    );
    expect(screen.queryByRole('columnheader', { name: 'Owner' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Columns/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onHidden).toHaveBeenLastCalledWith([]);
  });
});

describe('selection and actions', () => {
  it('shows the count and bulk actions at the right of the tools line while rows are selected', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        selectable
        selected={new Set(['1', '2'])}
        onSelectionChange={vi.fn()}
        bulkActions={<button type="button">Export selected</button>}
        search={{ value: '', onChange: vi.fn(), placeholder: 'Search' }}
      />,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export selected' })).toBeInTheDocument();
  });

  it('offers a select-all checkbox and one checkbox per row', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        selectable
        selected={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('checkbox', { name: 'Select all rows on this page' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: 'Select row' })).toHaveLength(2);
  });

  it('pins a titled Actions column at the right', async () => {
    const onClick = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(r) => r.id}
        rowActions={[{ key: 'open', label: 'Open', onClick }]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toHaveClass('uab-sticky-right');
    await userEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Open' }));
    expect(onClick).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe('DataTablePagination', () => {
  it('shows the range and item count, numbered pages with ellipses and a per-page dropdown', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <DataTablePagination
        pagination={{ page: 5, pageSize: 25, total: 500 }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    expect(screen.getByText('101–125')).toBeInTheDocument();
    expect(screen.getByText(/of 500 items/)).toBeInTheDocument();
    const pages = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(pages).getByRole('button', { name: 'Page 5' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(pages).getAllByText('…')).toHaveLength(2);
    await userEvent.click(within(pages).getByRole('button', { name: 'Page 20' }));
    expect(onPageChange).toHaveBeenCalledWith(20);

    const size = screen.getByRole('button', { name: 'Rows per page: 25 / page' });
    await userEvent.click(size);
    await userEvent.click(await screen.findByRole('option', { name: '50 / page' }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('does not show an ellipsis for a gap of one page and has no page-size control without a handler', () => {
    render(<DataTablePagination pagination={{ page: 1, pageSize: 10, total: 30 }} />);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rows per page/ })).not.toBeInTheDocument();
    expect(screen.getByText('1–10')).toBeInTheDocument();
  });
});
