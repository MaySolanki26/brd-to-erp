import { useMemo, useState } from 'react';
import {
  Button,
  DateText,
  DataTable,
  DatePicker,
  EmptyValue,
  FormDrawer,
  FormGrid,
  FormGridItem,
  InformativeBar,
  Input,
  Label,
  MultiSelectMenu,
  OverflowChips,
  PageShell,
  RecordInspector,
  SelectMenu,
  StatusBadge,
  ViewBar,
  confirmDelete,
  toast,
  type DataTableColumnDef,
  type DataTableFilterValues,
  type SortState,
} from '@brd/ui';
import { useHiddenColumns } from '@/features/shell/hooks/use-hidden-columns';
import {
  SAMPLE_ACTIVITY,
  SAMPLE_COMMENTS,
  SAMPLE_MODULE_OPTIONS,
  SAMPLE_REQUIREMENTS,
  SAMPLE_STATUS_LABELS,
  SAMPLE_STATUS_TONES,
  type SampleComment,
  type SampleRequirement,
  type SampleStatus,
} from './sample-data';

const VIEWS = [
  { id: 'all', name: 'All' },
  { id: 'review', name: 'Needs review' },
  { id: 'mine', name: 'Mine' },
];

const STATUS_FILTER = {
  id: 'status',
  label: 'Filter by status',
  options: (Object.keys(SAMPLE_STATUS_LABELS) as SampleStatus[]).map((value) => ({
    value,
    label: SAMPLE_STATUS_LABELS[value],
  })),
};

const COLUMNS: DataTableColumnDef<SampleRequirement>[] = [
  { id: 'title', header: 'Requirement', sortable: true, canHide: false, width: 280 },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <StatusBadge
        label={SAMPLE_STATUS_LABELS[row.status]}
        tone={SAMPLE_STATUS_TONES[row.status]}
      />
    ),
  },
  { id: 'owner', header: 'Owner' },
  {
    id: 'modules',
    header: 'Modules',
    width: 220,
    cell: (row) => <OverflowChips items={row.modules} label="modules" />,
  },
  { id: 'updatedAt', header: 'Updated', kind: 'date', sortable: true },
];

function matches(row: SampleRequirement, view: string, search: string, status: string): boolean {
  if (view === 'review' && row.status !== 'NEEDS_REVIEW') return false;
  if (view === 'mine' && !row.mine) return false;
  if (status && row.status !== status) return false;
  return !search || row.title.toLowerCase().includes(search.toLowerCase());
}

/**
 * A page that shows the template components together on invented data. It is labelled as sample data
 * and is not connected to the server: saved views, comments and edits are not stored.
 */
export function DesignPage() {
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DataTableFilterValues>({});
  const [sort, setSort] = useState<SortState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useHiddenColumns('design-sample');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [comments, setComments] = useState<SampleComment[]>(SAMPLE_COMMENTS);
  const [draft, setDraft] = useState('');

  const rows = useMemo(() => {
    const filtered = SAMPLE_REQUIREMENTS.filter((row) =>
      matches(row, view, search, filters.status ?? ''),
    );
    if (!sort) return filtered;
    const direction = sort.order === 'asc' ? 1 : -1;
    const key = sort.key as 'title' | 'updatedAt';
    return [...filtered].sort((a, b) => direction * a[key].localeCompare(b[key]));
  }, [view, search, filters, sort]);

  const unsaved = search !== '' || (filters.status ?? '') !== '';
  const openIndex = rows.findIndex((row) => row.id === openId);
  const open = openIndex >= 0 ? rows[openIndex] : undefined;
  const neighbour = (offset: number) => rows[openIndex + offset];

  const sampleOnly = (what: string): void => {
    toast.info(`${what} needs the server, which is not connected yet.`);
  };

  return (
    <PageShell>
      <InformativeBar
        title="Design system"
        info="Sample data only. Nothing on this page is saved or sent to the server."
      />
      <ViewBar
        views={VIEWS}
        activeId={view}
        onSelect={setView}
        onAddView={() => sampleOnly('Saving a view')}
        unsaved={unsaved}
        onSaveView={() => sampleOnly('Saving a view')}
        onSaveAsNew={() => sampleOnly('Saving a view')}
        onReset={() => {
          setSearch('');
          setFilters({});
        }}
        actions={
          <>
            <Button variant="outline" onClick={() => sampleOnly('Export')}>
              Export
            </Button>
            <Button onClick={() => setNewOpen(true)}>New requirement</Button>
          </>
        }
      />
      <PageShell.Body scroll>
        <DataTable<SampleRequirement>
          columns={COLUMNS}
          data={rows}
          getRowId={(row) => row.id}
          search={{ value: search, onChange: setSearch, placeholder: 'Search requirements' }}
          filters={[STATUS_FILTER]}
          filterValues={filters}
          onApplyFilters={setFilters}
          onClearFilters={() => {
            setFilters({});
            setSearch('');
          }}
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={setHiddenColumns}
          sort={sort}
          onSort={setSort}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          bulkActions={
            <Button variant="outline" onClick={() => sampleOnly('Changing status')}>
              Change status
            </Button>
          }
          rowActions={[
            { key: 'open', label: 'Open', onClick: (row) => setOpenId(row.id) },
            {
              key: 'delete',
              label: 'Delete',
              destructive: true,
              onClick: (row) =>
                confirmDelete({
                  title: 'Delete requirement?',
                  message: `"${row.title}" is removed from this sample list. Nothing is saved.`,
                  onConfirm: () => sampleOnly('Deleting'),
                }),
            },
          ]}
          onRowClick={(row) => setOpenId(row.id)}
          emptyTitle="No matching requirements"
          emptyDescription="Change or clear the filters to see more."
          pagination={{ page: 1, pageSize: 25, total: rows.length }}
        />
      </PageShell.Body>

      <RecordInspector
        open={open !== undefined}
        onOpenChange={(next) => !next && setOpenId(null)}
        title={open?.title ?? ''}
        description="A sample record. Edit and comments are not saved."
        status={
          open && (
            <StatusBadge
              label={SAMPLE_STATUS_LABELS[open.status]}
              tone={SAMPLE_STATUS_TONES[open.status]}
            />
          )
        }
        onPrevious={neighbour(-1) ? () => setOpenId(neighbour(-1)?.id ?? null) : undefined}
        onNext={neighbour(1) ? () => setOpenId(neighbour(1)?.id ?? null) : undefined}
        onEdit={() => sampleOnly('Editing')}
        comment={{
          value: draft,
          onChange: setDraft,
          onSubmit: () => {
            setComments((current) => [
              ...current,
              {
                id: `c${String(current.length + 1)}`,
                author: 'You',
                text: draft.trim(),
                time: 'Just now',
              },
            ]);
            setDraft('');
          },
        }}
        tabs={[
          {
            key: 'details',
            label: 'Details',
            content: open && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-fs-supportive">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="col-span-2 -mt-2">{open.description}</dd>
                <dt className="text-muted-foreground">Owner</dt>
                <dd>{open.owner ?? <EmptyValue />}</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>
                  <DateText value={open.updatedAt} />
                </dd>
                <dt className="text-muted-foreground">Modules</dt>
                <dd className="col-span-2 -mt-2">
                  <OverflowChips items={open.modules} label="modules" />
                </dd>
              </dl>
            ),
          },
          {
            key: 'related',
            label: 'Related',
            content: (
              <p className="text-fs-supportive text-muted-foreground">
                No related records in the sample.
              </p>
            ),
          },
          {
            key: 'activity',
            label: 'Activity',
            content: (
              <ol className="space-y-2 text-fs-supportive">
                {SAMPLE_ACTIVITY.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-3">
                    <span>{entry.text}</span>
                    <span className="text-muted-foreground">{entry.time}</span>
                  </li>
                ))}
              </ol>
            ),
          },
          {
            key: 'comments',
            label: 'Comments',
            content: (
              <ul className="space-y-3 text-fs-supportive">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <p className="font-medium">
                      {comment.author}{' '}
                      <span className="font-normal text-muted-foreground">· {comment.time}</span>
                    </p>
                    <p>{comment.text}</p>
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
      />

      <NewRequirementDrawer
        open={newOpen}
        onOpenChange={setNewOpen}
        onSubmit={() => sampleOnly('Saving a requirement')}
      />
    </PageShell>
  );
}

interface NewRequirementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

/** Form fields flow 1 → 2 → 3 per row from the width; long fields take the full row. */
function NewRequirementDrawer({ open, onOpenChange, onSubmit }: NewRequirementDrawerProps) {
  const [owner, setOwner] = useState('');
  const [modules, setModules] = useState<string[]>([]);
  const [due, setDue] = useState<string | null>(null);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New requirement"
      description="A sample form. Saving is not connected yet."
      submitLabel="Save"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormGrid>
        <FormGridItem full>
          <Label htmlFor="sample-title">Title</Label>
          <Input id="sample-title" />
        </FormGridItem>
        <FormGridItem>
          <Label htmlFor="sample-owner">Owner</Label>
          <SelectMenu
            block
            id="sample-owner"
            label="Owner"
            placeholder="None"
            value={owner}
            onChange={setOwner}
            options={[
              { value: '', label: 'None' },
              { value: 'asha', label: 'Asha Rao' },
              { value: 'ben', label: 'Ben Ortiz' },
            ]}
          />
        </FormGridItem>
        <FormGridItem>
          <Label htmlFor="sample-due">Due date</Label>
          <DatePicker
            id="sample-due"
            block
            label="Due date"
            value={due}
            onChange={setDue}
            placeholder="Pick a date"
          />
        </FormGridItem>
        <FormGridItem full>
          <Label>Modules</Label>
          <MultiSelectMenu
            block
            label="modules"
            values={modules}
            onChange={setModules}
            options={SAMPLE_MODULE_OPTIONS}
            emptyLabel="Select modules"
          />
        </FormGridItem>
      </FormGrid>
    </FormDrawer>
  );
}
