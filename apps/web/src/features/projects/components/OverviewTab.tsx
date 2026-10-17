import type { ProjectDto } from '@brd/shared';
import type { QuestionFilters } from '@/features/questions/hooks/use-question-filters';
import { OpenCriticalCard } from '@/features/summary/components/OpenCriticalCard';
import { SummaryPanel } from '@/features/summary/components/SummaryPanel';
import { KnowledgeCountsPanel } from '@/features/knowledge/components/KnowledgeCountsPanel';
import { ProcessingPanel } from '@/features/knowledge/components/ProcessingPanel';
import { ROLE_LABELS, formatDate } from '../project-labels';

interface OverviewTabProps {
  project: ProjectDto;
  canRefreshSummary: boolean;
  /** Switches to the Questions tab, optionally with filters already applied. */
  onOpenQuestions: (preset: Partial<QuestionFilters>) => void;
}

export function OverviewTab({ project, canRefreshSummary, onOpenQuestions }: OverviewTabProps) {
  return (
    <div className="space-y-8">
      <dl className="grid max-w-xl grid-cols-[8rem_1fr] gap-y-3 text-sm">
        <dt className="text-muted-foreground">Description</dt>
        <dd>{project.description ?? 'No description'}</dd>
        <dt className="text-muted-foreground">Your role</dt>
        <dd>{project.myRole ? ROLE_LABELS[project.myRole] : 'Organization admin'}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{formatDate(project.createdAt)}</dd>
        <dt className="text-muted-foreground">Last updated</dt>
        <dd>{formatDate(project.updatedAt)}</dd>
      </dl>
      <OpenCriticalCard
        projectId={project.id}
        onReview={() => onOpenQuestions({ status: 'OPEN', priority: 'CRITICAL' })}
      />
      <SummaryPanel projectId={project.id} canRefresh={canRefreshSummary} />
      <ProcessingPanel projectId={project.id} />
      <KnowledgeCountsPanel projectId={project.id} />
    </div>
  );
}
