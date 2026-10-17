# Components

> Every file below was compiled, linted and tested in a scratch copy of this repository (2026-10-17). Copy it, then rename. Paths are relative to the repository root.

## A tab with the five states inline, a permission-gated button and a drawer form

### `apps/web/src/features/milestones/components/MilestonesTab.tsx`

```ts
import { useState } from 'react';
import { Flag, Plus } from 'lucide-react';
import { z } from 'zod';
import { ProjectPermission, type ProjectRole } from '@brd/shared';
import {
  Button,
  DataTablePagination,
  EmptyState,
  NoAccess,
  PageError,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@brd/ui';
import { Can } from '@/components/guards/Can';
import { useUrlState } from '@/hooks/use-url-state';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { MILESTONES_PAGE_SIZE, useMilestones } from '../hooks/use-milestones';
import { CreateMilestoneDrawer } from './CreateMilestoneDrawer';

interface MilestonesTabProps {
  projectId: string;
  /** The caller's role in this project, from the project record. */
  projectRole: ProjectRole | null;
}

const URL_STATE = z.object({ milestonesPage: z.coerce.number().int().min(1).catch(1) });
const SKELETON_COLUMNS = [{ kind: 'text' }, { kind: 'text' }, { kind: 'badge' }] as const;

export function MilestonesTab({ projectId, projectRole }: MilestonesTabProps) {
  const [{ milestonesPage }, setUrlState] = useUrlState(URL_STATE);
  const milestones = useMilestones(projectId, milestonesPage);
  const [createOpen, setCreateOpen] = useState(false);

  if (milestones.isError && isForbidden(milestones.error)) {
    return <NoAccess description="You do not have access to this project's milestones." />;
  }

  const addButton = (
    <Can permission={ProjectPermission.UPDATE_PROJECT} projectRole={projectRole}>
      <Button size="sm" onClick={() => setCreateOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New milestone
      </Button>
    </Can>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Milestones</h2>
        {addButton}
      </div>

      {milestones.isPending && <TableSkeleton columns={[...SKELETON_COLUMNS]} rows={3} />}
      {milestones.isError && (
        <PageError
          message="Could not load milestones"
          description={errorMessage(milestones.error)}
          onRetry={() => void milestones.refetch()}
        />
      )}
      {milestones.isSuccess && milestones.data.items.length === 0 && (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Add the dates the team is working towards."
        />
      )}
      {milestones.isSuccess && milestones.data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.data.items.map((milestone) => (
              <TableRow key={milestone.id}>
                <TableCell className="font-medium">{milestone.title}</TableCell>
                <TableCell>{milestone.dueDate ?? 'No date'}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={milestone.status}
                    tone={milestone.status === 'DONE' ? 'success' : 'neutral'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {milestones.isSuccess && milestones.data.total > MILESTONES_PAGE_SIZE && (
        <DataTablePagination
          pagination={{
            page: milestones.data.page,
            pageSize: milestones.data.pageSize,
            total: milestones.data.total,
          }}
          onPageChange={(page) => setUrlState({ milestonesPage: page })}
        />
      )}
      <CreateMilestoneDrawer projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

### `apps/web/src/features/milestones/components/CreateMilestoneDrawer.tsx`

```ts
import { useEffect } from 'react';
import { milestoneFormSchema, type MilestoneFormValues } from '@brd/shared';
import {
  Form,
  FormControl,
  FormDrawer,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { errorMessage } from '@/lib/error-message';
import { useCreateMilestone } from '../hooks/use-milestones';

interface CreateMilestoneDrawerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY: MilestoneFormValues = { title: '', dueDate: '' };

export function CreateMilestoneDrawer({ projectId, open, onOpenChange }: CreateMilestoneDrawerProps) {
  const form = useZodForm(milestoneFormSchema, { defaultValues: EMPTY });
  const createMilestone = useCreateMilestone(projectId);
  const { reset: resetForm } = form;
  const { reset: resetMutation } = createMilestone;

  useEffect(() => {
    if (open) {
      resetForm(EMPTY);
      resetMutation();
    }
  }, [open, resetForm, resetMutation]);

  const submit = form.handleSubmit((values) =>
    createMilestone.mutate(
      { title: values.title, dueDate: values.dueDate === '' ? null : values.dueDate },
      { onSuccess: () => onOpenChange(false) },
    ),
  );

  return (
    <Form {...form}>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="New milestone"
        description="A date the team is working towards."
        size="lg"
        onSubmit={submit}
        submitLabel="Add milestone"
        isPending={createMilestone.isPending}
        dirty={form.formState.isDirty}
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormError message={createMilestone.error ? errorMessage(createMilestone.error) : null} />
        </div>
      </FormDrawer>
    </Form>
  );
}
```

### Mounting the tab

```ts
// apps/web/src/features/projects/ProjectDetailPage.tsx — one entry in the `tabs` array
import { MilestonesTab } from '@/features/milestones/components/MilestonesTab';
// ...
{
  key: 'milestones',
  label: 'Milestones',
  content: <MilestonesTab projectId={data.id} projectRole={data.myRole} />,
},
```

## A routed form page (FormPage)

Route it as `projects/:projectId/settings` under `AppLayout`, lazy-loaded like the other pages.

### `apps/web/src/features/projects/ProjectSettingsPage.tsx`

```ts
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ProjectPermission } from '@brd/shared';
import {
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormPage,
  Input,
  Textarea,
} from '@brd/ui';
import { useCan } from '@/hooks/use-can';
import { useZodForm } from '@/hooks/use-zod-form';
import { ApiClientError } from '@/lib/api-client';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { useProject } from './hooks/use-projects';
import { useUpdateProject } from './hooks/use-update-project';

// The form edits plain text; an empty description is sent as null.
const settingsFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000),
});

export function ProjectSettingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const update = useUpdateProject(projectId);
  const canAct = useCan();
  const form = useZodForm(settingsFormSchema, { defaultValues: { name: '', description: '' } });
  const { reset: resetForm } = form;

  const data = project.data;
  useEffect(() => {
    if (data) resetForm({ name: data.name, description: data.description ?? '' });
  }, [data, resetForm]);

  const back = () => navigate(`/projects/${projectId}`);
  const allowed = data
    ? canAct({ permission: ProjectPermission.UPDATE_PROJECT, projectRole: data.myRole })
    : true;

  const state = project.isPending
    ? 'loading'
    : project.isError
      ? isForbidden(project.error) || (project.error instanceof ApiClientError && project.error.status === 404)
        ? 'no-access'
        : 'error'
      : allowed
        ? 'ready'
        : 'no-access';

  const submit = form.handleSubmit((values) =>
    update.mutate(
      { name: values.name, description: values.description === '' ? null : values.description },
      { onSuccess: back },
    ),
  );

  return (
    <FormPage
      state={state}
      title="Project settings"
      onBack={back}
      onSubmit={(event) => void submit(event)}
      onCancel={back}
      submitLabel="Save settings"
      submitting={update.isPending}
      submitDisabled={!form.formState.isDirty}
      errorMessage="Could not load the project"
      errorDescription={project.error ? errorMessage(project.error) : undefined}
      onRetry={() => void project.refetch()}
      noAccessDescription="Only project owners can change these settings."
    >
      <Form {...form}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormError message={update.error ? errorMessage(update.error) : null} />
        </div>
      </Form>
    </FormPage>
  );
}
```

## A routed list (ListPage): the current `ProjectsPage`

### `apps/web/src/features/projects/ProjectsPage.tsx` (the part that uses the pattern)

```tsx
  const listState = projectsListState(projects);

  return (
    <ListPage
      state={listState}
      title="Projects"
      info="Projects you can access"
      actionBarRight={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New project
        </Button>
      }
      toolbar={
        <SearchInput
          value={search}
          onChange={changeSearch}
          placeholder="Search projects by name"
          aria-label="Search projects"
          className="mb-4 max-w-sm"
        />
      }
      loadingFallback={<TableSkeleton columns={[...SKELETON_COLUMNS]} rows={5} />}
      errorMessage="Could not load projects"
      errorDescription={errorMessage(projects.error)}
      onRetry={() => void projects.refetch()}
      noAccessDescription="You do not have access to projects."
      emptyIcon={FolderKanban}
      emptyTitle={isSearching ? 'No matching projects' : 'No projects yet'}
      emptyDescription={
        isSearching
          ? `Nothing you can access matches "${search}".`
          : 'Create a project, or ask an owner to add you to one.'
      }
      emptyAction={
        <Button
          size="xs"
          className="gap-2"
          onClick={isSearching ? () => changeSearch('') : () => setCreateOpen(true)}
        >
          {!isSearching && <Plus className="h-4 w-4" strokeWidth={1.5} />}
          {isSearching ? 'Show all projects' : 'New project'}
        </Button>
      }
      footer={
        projects.data && projects.data.total > PROJECTS_PAGE_SIZE ? (
          <DataTablePagination
            pagination={{
              page: projects.data.page,
              pageSize: projects.data.pageSize,
              total: projects.data.total,
            }}
            onPageChange={(page) => setUrlState({ page })}
          />
        ) : null
      }
      overlays={
        <CreateProjectDrawer
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(project) => navigate(`/projects/${project.id}`)}
        />
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Your role</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.data?.items.map((project) => (
            <TableRow
              key={project.id}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => navigate(`/projects/${project.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') navigate(`/projects/${project.id}`);
              }}
            >
              <TableCell className="font-medium">{project.name}</TableCell>
              <TableCell>
                <StatusBadge label={project.status} tone={STATUS_TONES[project.status]} />
              </TableCell>
              <TableCell>{project.myRole ? ROLE_LABELS[project.myRole] : 'Admin access'}</TableCell>
              <TableCell>{formatDate(project.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ListPage>
  );
}
```

## A routed record with tabs (DetailPage): the current `ProjectDetailPage`

### `apps/web/src/features/projects/ProjectDetailPage.tsx` (the render)

```tsx
  return (
    <DetailPage
      state="ready"
      title={data.name}
      badge={<StatusBadge label={data.status} tone={STATUS_TONES[data.status]} />}
      onBack={() => navigate('/projects')}
      headerRight={
        isActive ? (
          <Can permission={ProjectPermission.ARCHIVE_PROJECT} projectRole={data.myRole}>
            <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
              <Archive className="mr-1 h-4 w-4" />
              Archive
            </Button>
          </Can>
        ) : null
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={selectTab}
      footer={
        <ConfirmDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          title="Archive project?"
          description="Archived projects are hidden from the project list and become read-only."
          variant="destructive"
          confirmLabel="Archive"
          isPending={archive.isPending}
          onConfirm={confirmArchive}
        />
      }
    />
  );
}
```

## Permission checks

### `<Can>` and `useCan()`

```ts
import { Can } from '@/components/guards/Can';
import { useCan } from '@/hooks/use-can';

// A button only owners (and org admins) should see
<Can permission={ProjectPermission.ARCHIVE_PROJECT} projectRole={project.myRole}>
  <Button onClick={archive}>Archive</Button>
</Can>

// A menu entry only org admins should see, with something else for everyone else
<Can roles={['ORG_ADMIN']} fallback={<p>Ask an admin.</p>}>
  <NavLink to="/team">Team</NavLink>
</Can>

// Logic instead of markup
const can = useCan();
const canAdd = project.status !== 'ARCHIVED' &&
  can({ permission: ProjectPermission.ADD_SOURCE, projectRole: project.myRole });
```
