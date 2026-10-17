import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, FileQuestion } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  DetailPage,
  StatusBadge,
  type DetailPageTab,
} from '@brd/ui';
import { ProjectPermission } from '@brd/shared';
import { Can } from '@/components/guards/Can';
import { useCan } from '@/hooks/use-can';
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

export function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAct = useCan();
  const project = useProject(projectId);
  const archive = useArchiveProject(projectId);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  if (project.isPending) return <DetailPage state="loading" onBack={() => navigate('/projects')} />;

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
      return (
        <DetailPage
          state="no-access"
          onBack={() => navigate('/projects')}
          noAccessDescription="You do not have access to this project."
        />
      );
    }
    return (
      <DetailPage
        state="error"
        onBack={() => navigate('/projects')}
        errorMessage="Could not load the project"
        errorDescription={errorMessage(project.error)}
        onRetry={() => void project.refetch()}
      />
    );
  }

  const data = project.data;
  const can = (permission: ProjectPermission) => canAct({ permission, projectRole: data.myRole });
  const isActive = data.status !== 'ARCHIVED';
  const canManage = can(ProjectPermission.MANAGE_MEMBERS);
  const canAddSource = isActive && can(ProjectPermission.ADD_SOURCE);
  const canReprocess = isActive && can(ProjectPermission.REPROCESS);
  const canAnswer = can(ProjectPermission.ANSWER_QUESTION);

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

  const tabs: DetailPageTab[] = [
    {
      key: 'overview',
      label: 'Overview',
      content: (
        <OverviewTab
          project={data}
          canRefreshSummary={canReprocess}
          onOpenQuestions={openQuestions}
        />
      ),
    },
    {
      key: 'sources',
      label: 'Sources',
      content: (
        <SourcesTab projectId={data.id} canAddSource={canAddSource} canReprocess={canReprocess} />
      ),
    },
    {
      key: 'requirements',
      label: 'Requirements',
      content: <RequirementsTab projectId={data.id} />,
    },
    { key: 'rules', label: 'Rules', content: <RulesTab projectId={data.id} /> },
    { key: 'modules', label: 'Modules', content: <ModulesTab projectId={data.id} /> },
    {
      key: 'questions',
      label: <QuestionsTabLabel projectId={data.id} />,
      content: <QuestionsTab projectId={data.id} canAnswer={canAnswer} />,
    },
    { key: 'decisions', label: 'Decisions', content: <DecisionsTab projectId={data.id} /> },
    ...(canManage
      ? [
          {
            key: 'members',
            label: 'Members',
            content: <MembersTab projectId={data.id} canManage currentUserId={user?.id ?? ''} />,
          },
        ]
      : []),
  ];
  const requestedTab = searchParams.get('tab') ?? 'overview';
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : 'overview';
  const selectTab = (tab: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );

  const confirmArchive = () =>
    archive.mutate(undefined, {
      onSettled: () => setArchiveOpen(false),
    });

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
