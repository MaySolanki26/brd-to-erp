import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import {
  Button,
  DataTablePagination,
  EmptyState,
  InformativeBar,
  NoAccess,
  PageError,
  PageShell,
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

  return (
    <PageShell>
      <InformativeBar title="Projects" info="Projects you can access">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New project
        </Button>
      </InformativeBar>
      <PageShell.Body padded>
        <SearchInput
          value={search}
          onChange={changeSearch}
          placeholder="Search projects by name"
          aria-label="Search projects"
          className="mb-4 max-w-sm"
        />
        {projects.isPending && <TableSkeleton columns={[...SKELETON_COLUMNS]} rows={5} />}
        {projects.isError &&
          (isForbidden(projects.error) ? (
            <NoAccess description="You do not have access to projects." />
          ) : (
            <PageError
              message="Could not load projects"
              description={errorMessage(projects.error)}
              onRetry={() => void projects.refetch()}
            />
          ))}
        {projects.isSuccess && projects.data.items.length === 0 && isSearching && (
          <EmptyState
            icon={FolderKanban}
            title="No matching projects"
            description={`Nothing you can access matches "${search}".`}
            actionLabel="Show all projects"
            onAction={() => changeSearch('')}
          />
        )}
        {projects.isSuccess && projects.data.items.length === 0 && !isSearching && (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project, or ask an owner to add you to one."
            actionLabel="New project"
            onAction={() => setCreateOpen(true)}
          />
        )}
        {projects.isSuccess && projects.data.items.length > 0 && (
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
              {projects.data.items.map((project) => (
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
                  <TableCell>
                    {project.myRole ? ROLE_LABELS[project.myRole] : 'Admin access'}
                  </TableCell>
                  <TableCell>{formatDate(project.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {projects.isSuccess && projects.data.total > PROJECTS_PAGE_SIZE && (
          <DataTablePagination
            pagination={{
              page: projects.data.page,
              pageSize: projects.data.pageSize,
              total: projects.data.total,
            }}
            onPageChange={setPageNumber}
          />
        )}
      </PageShell.Body>
      <CreateProjectDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => navigate(`/projects/${project.id}`)}
      />
    </PageShell>
  );
}
