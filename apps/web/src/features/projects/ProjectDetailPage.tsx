import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, FileQuestion } from 'lucide-react';
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
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ApiClientError } from '@/lib/api-client';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { DecisionsTab } from '@/features/decisions/components/DecisionsTab';
import { ModulesTab } from '@/features/knowledge/components/ModulesTab';
import { RequirementsTab } from '@/features/knowledge/components/RequirementsTab';
import { RulesTab } from '@/features/knowledge/components/RulesTab';
import { QuestionsTab } from '@/features/questions/components/QuestionsTab';
import { QuestionsTabLabel } from '@/features/questions/components/QuestionsTabLabel';
import {
  applyQuestionFilters,
  clearQuestionFilters,
  type QuestionFilters,
} from '@/features/questions/hooks/use-question-filters';
import { MembersTab } from './components/MembersTab';
import { OverviewTab } from './components/OverviewTab';
import { SourcesTab } from './components/SourcesTab';
import { useArchiveProject } from './hooks/use-project-mutations';
import { useProject } from './hooks/use-projects';
import { STATUS_TONES } from './project-labels';

const MANAGE_ROLES = projectRolesWith(ProjectPermission.MANAGE_MEMBERS);
const ARCHIVE_ROLES = projectRolesWith(ProjectPermission.ARCHIVE_PROJECT);
const ADD_SOURCE_ROLES = projectRolesWith(ProjectPermission.ADD_SOURCE);
const REPROCESS_ROLES = projectRolesWith(ProjectPermission.REPROCESS);
const ANSWER_ROLES = projectRolesWith(ProjectPermission.ANSWER_QUESTION);

const BASE_TABS = [
  'overview',
  'sources',
  'requirements',
  'rules',
  'modules',
  'questions',
  'decisions',
];

export function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const project = useProject(projectId);
  const archive = useArchiveProject(projectId);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

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
  const canAnswer = isOrgAdmin || (data.myRole !== null && ANSWER_ROLES.includes(data.myRole));
  const canArchive =
    data.status !== 'ARCHIVED' &&
    (isOrgAdmin || (data.myRole !== null && ARCHIVE_ROLES.includes(data.myRole)));

  const requestedTab = searchParams.get('tab') ?? 'overview';
  const validTabs = canManage ? [...BASE_TABS, 'members'] : BASE_TABS;
  const activeTab = validTabs.includes(requestedTab) ? requestedTab : 'overview';
  const selectTab = (tab: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );

  const openQuestions = (preset: Partial<QuestionFilters>) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'questions');
        clearQuestionFilters(next);
        applyQuestionFilters(next, preset);
        return next;
      },
      { replace: true },
    );

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
        <Tabs value={activeTab} onValueChange={selectTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="questions">
              <QuestionsTabLabel projectId={data.id} />
            </TabsTrigger>
            <TabsTrigger value="decisions">Decisions</TabsTrigger>
            {canManage && <TabsTrigger value="members">Members</TabsTrigger>}
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <OverviewTab
              project={data}
              canRefreshSummary={canReprocess}
              onOpenQuestions={openQuestions}
            />
          </TabsContent>
          <TabsContent value="sources" className="mt-4">
            <SourcesTab
              projectId={data.id}
              canAddSource={canAddSource}
              canReprocess={canReprocess}
            />
          </TabsContent>
          <TabsContent value="requirements" className="mt-4">
            <RequirementsTab projectId={data.id} />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <RulesTab projectId={data.id} />
          </TabsContent>
          <TabsContent value="modules" className="mt-4">
            <ModulesTab projectId={data.id} />
          </TabsContent>
          <TabsContent value="questions" className="mt-4">
            <QuestionsTab projectId={data.id} canAnswer={canAnswer} />
          </TabsContent>
          <TabsContent value="decisions" className="mt-4">
            <DecisionsTab projectId={data.id} />
          </TabsContent>
          {canManage && (
            <TabsContent value="members" className="mt-4">
              <MembersTab projectId={data.id} canManage currentUserId={user?.id ?? ''} />
            </TabsContent>
          )}
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
