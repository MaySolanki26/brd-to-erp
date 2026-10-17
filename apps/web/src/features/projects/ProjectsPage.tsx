import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import {
  Button,
  DataTablePagination,
  ListPage,
  SearchInput,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@brd/ui';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { CreateProjectDrawer } from './components/CreateProjectDrawer';
import { PROJECTS_PAGE_SIZE, useProjects } from './hooks/use-projects';
import { ROLE_LABELS, STATUS_TONES, formatDate } from './project-labels';

const SKELETON_COLUMNS = [
  { kind: 'text' },
  { kind: 'badge' },
  { kind: 'badge' },
  { kind: 'text' },
] as const;

type ProjectsQuery = ReturnType<typeof useProjects>;

function projectsListState(projects: ProjectsQuery) {
  if (projects.isPending) return 'loading';
  if (projects.isError) return isForbidden(projects.error) ? 'no-access' : 'error';
  return projects.data.items.length === 0 ? 'empty' : 'ready';
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const projects = useProjects({ page: pageNumber, search });
  const [createOpen, setCreateOpen] = useState(false);

  const changeSearch = (value: string) => {
    setSearch(value.trim());
    setPageNumber(1);
  };
  const isSearching = search.length > 0;

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
            onPageChange={setPageNumber}
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
