import { useState } from 'react';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { Button, DataTable, ListPage, StatusBadge, type DataTableColumnDef } from '@brd/ui';
import type { ProjectDto } from '@brd/shared';
import { useUrlState } from '@/hooks/use-url-state';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { CreateProjectDrawer } from './components/CreateProjectDrawer';
import { PROJECTS_PAGE_SIZE, useProjects } from './hooks/use-projects';
import { PROJECT_STATUS_LABELS, ROLE_LABELS, STATUS_TONES } from './project-labels';

const PROJECTS_URL_SCHEMA = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().max(200).catch(''),
});

const NOUN = { one: 'project', other: 'projects' };

const COLUMNS: DataTableColumnDef<ProjectDto>[] = [
  { id: 'name', header: 'Name', width: 280, canHide: false },
  {
    id: 'status',
    header: 'Status',
    width: 140,
    cell: (project) => (
      <StatusBadge
        label={PROJECT_STATUS_LABELS[project.status]}
        tone={STATUS_TONES[project.status]}
      />
    ),
  },
  {
    id: 'myRole',
    header: 'Your role',
    width: 140,
    cell: (project) => (project.myRole ? ROLE_LABELS[project.myRole] : 'Admin access'),
  },
  { id: 'createdAt', header: 'Created', kind: 'date', width: 140 },
];

type ProjectsQuery = ReturnType<typeof useProjects>;

function projectsListState(projects: ProjectsQuery) {
  if (projects.isPending) return 'loading';
  if (projects.isError) return isForbidden(projects.error) ? 'no-access' : 'error';
  return projects.data.items.length === 0 ? 'empty' : 'ready';
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [{ search, page: pageNumber }, setUrlState] = useUrlState(PROJECTS_URL_SCHEMA);
  const projects = useProjects({ page: pageNumber, search });
  const [createOpen, setCreateOpen] = useState(false);

  const changeSearch = (value: string) => setUrlState({ search: value.trim(), page: 1 });
  const isSearching = search.length > 0;
  const listState = projectsListState(projects);
  const result = projects.data;

  const createButton = (
    <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
      New project
    </Button>
  );

  return (
    <ListPage
      state={listState === 'empty' && isSearching ? 'ready' : listState}
      title="Projects"
      info="Projects you can access"
      viewLabel="All projects"
      actionBarRight={createButton}
      errorMessage="Could not load projects"
      errorDescription={errorMessage(projects.error)}
      onRetry={() => void projects.refetch()}
      noAccessDescription="You do not have access to projects."
      emptyIcon={FolderKanban}
      emptyTitle="No projects yet"
      emptyDescription="Create a project, or ask an owner to add you to one."
      emptyAction={createButton}
      overlays={
        <CreateProjectDrawer
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(project) => navigate(`/projects/${project.id}`)}
        />
      }
    >
      <DataTable<ProjectDto>
        ariaLabel="Projects table"
        noun={NOUN}
        columns={COLUMNS}
        data={result?.items ?? []}
        getRowId={(project) => project.id}
        search={{
          value: search,
          onChange: changeSearch,
          placeholder: 'Search',
          ariaLabel: 'Search projects',
        }}
        onClearFilters={() => changeSearch('')}
        onRowClick={(project) => navigate(`/projects/${project.id}`)}
        rowActions={[
          {
            key: 'open',
            label: 'Open project',
            icon: 'eye',
            quick: true,
            onClick: (project) => navigate(`/projects/${project.id}`),
          },
        ]}
        emptyIcon={FolderKanban}
        emptyTitle="No matching projects"
        emptyDescription={`Nothing you can access matches "${search}".`}
        emptyAction={<Button onClick={() => changeSearch('')}>Show all projects</Button>}
        pagination={
          result
            ? { page: result.page, pageSize: PROJECTS_PAGE_SIZE, total: result.total }
            : undefined
        }
        onPageChange={(page) => setUrlState({ page })}
      />
    </ListPage>
  );
}
