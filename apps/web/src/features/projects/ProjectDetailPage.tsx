import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InformativeBar,
  NoAccess,
  PageError,
  PageLoader,
  PageShell,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@brd/ui';
import { ProjectPermission, projectRolesWith } from '@brd/shared';
import { FileQuestion } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ApiClientError } from '@/lib/api-client';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { MembersTab } from './components/MembersTab';
import { SourcesTab } from './components/SourcesTab';
import { useArchiveProject } from './hooks/use-project-mutations';
import { useProject } from './hooks/use-projects';
import { ROLE_LABELS, STATUS_TONES, formatDate } from './project-labels';

const MANAGE_ROLES = projectRolesWith(ProjectPermission.MANAGE_MEMBERS);
const ARCHIVE_ROLES = projectRolesWith(ProjectPermission.ARCHIVE_PROJECT);
const ADD_SOURCE_ROLES = projectRolesWith(ProjectPermission.ADD_SOURCE);
const REPROCESS_ROLES = projectRolesWith(ProjectPermission.REPROCESS);

export function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const project = useProject(projectId);
  const archive = useArchiveProject(projectId);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (project.isPending) return <PageLoader />;

  if (project.isError) {
    if (project.error instanceof ApiClientError && project.error.status === 404) {
      return (
        <EmptyState
          icon={FileQuestion}
          title="Project not found"
          description="It may have been removed, or you may not have access."
          actionLabel="Back to projects"
          onAction={() => navigate('/projects')}
          fill
        />
      );
    }
    if (isForbidden(project.error)) {
      return <NoAccess variant="full" description="You do not have access to this project." />;
    }
    return (
      <PageError
        variant="full"
        message="Could not load the project"
        description={errorMessage(project.error)}
        onRetry={() => void project.refetch()}
      />
    );
  }

  const data = project.data;
  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const canManage = isOrgAdmin || (data.myRole !== null && MANAGE_ROLES.includes(data.myRole));
  const canAddSource =
    data.status !== 'ARCHIVED' &&
    (isOrgAdmin || (data.myRole !== null && ADD_SOURCE_ROLES.includes(data.myRole)));
  const canReprocess =
    data.status !== 'ARCHIVED' &&
    (isOrgAdmin || (data.myRole !== null && REPROCESS_ROLES.includes(data.myRole)));
  const canArchive =
    data.status !== 'ARCHIVED' &&
    (isOrgAdmin || (data.myRole !== null && ARCHIVE_ROLES.includes(data.myRole)));

  const confirmArchive = () =>
    archive.mutate(undefined, {
      onSuccess: () => {
        toast.success('Project archived');
        setArchiveOpen(false);
      },
      onError: (err) => {
        toast.error(errorMessage(err));
        setArchiveOpen(false);
      },
    });

  return (
    <PageShell>
      <InformativeBar
        title={data.name}
        badge={<StatusBadge label={data.status} tone={STATUS_TONES[data.status]} />}
        onBack={() => navigate('/projects')}
      >
        {canArchive && (
          <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
            <Archive className="mr-1 h-4 w-4" />
            Archive
          </Button>
        )}
      </InformativeBar>
      <PageShell.Body padded>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <dl className="grid max-w-xl grid-cols-[8rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Description</dt>
              <dd>{data.description ?? 'No description'}</dd>
              <dt className="text-muted-foreground">Your role</dt>
              <dd>{data.myRole ? ROLE_LABELS[data.myRole] : 'Organization admin'}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(data.createdAt)}</dd>
              <dt className="text-muted-foreground">Last updated</dt>
              <dd>{formatDate(data.updatedAt)}</dd>
            </dl>
          </TabsContent>
          <TabsContent value="sources" className="mt-4">
            <SourcesTab
              projectId={data.id}
              canAddSource={canAddSource}
              canReprocess={canReprocess}
            />
          </TabsContent>
          <TabsContent value="members" className="mt-4">
            <MembersTab projectId={data.id} canManage={canManage} currentUserId={user?.id ?? ''} />
          </TabsContent>
        </Tabs>
      </PageShell.Body>
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
    </PageShell>
  );
}
