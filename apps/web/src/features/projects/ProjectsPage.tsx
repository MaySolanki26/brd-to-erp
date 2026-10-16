import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import {
  Button,
  EmptyState,
  InformativeBar,
  NoAccess,
  PageError,
  PageShell,
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
import { useProjects } from './hooks/use-projects';
import { ROLE_LABELS, STATUS_TONES, formatDate } from './project-labels';

const SKELETON_COLUMNS = [
  { kind: 'text' },
  { kind: 'badge' },
  { kind: 'badge' },
  { kind: 'text' },
] as const;

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjects();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PageShell>
      <InformativeBar title="Projects" info="Projects you can access">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New project
        </Button>
      </InformativeBar>
      <PageShell.Body padded>
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
        {projects.isSuccess && projects.data.items.length === 0 && (
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
      </PageShell.Body>
      <CreateProjectDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => navigate(`/projects/${project.id}`)}
      />
    </PageShell>
  );
}
