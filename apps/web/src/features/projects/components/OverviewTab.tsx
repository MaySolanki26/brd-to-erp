import { DateText } from '@brd/ui';
import type { ProjectDto } from '@brd/shared';
import type { QuestionFilters } from '@/features/questions/hooks/use-question-filters';
import { OpenCriticalCard } from '@/features/summary/components/OpenCriticalCard';
import { SummaryPanel } from '@/features/summary/components/SummaryPanel';
import { KnowledgeCountsPanel } from '@/features/knowledge/components/KnowledgeCountsPanel';
import { ProcessingPanel } from '@/features/knowledge/components/ProcessingPanel';
import { ROLE_LABELS } from '../project-labels';

interface OverviewTabProps {
  project: ProjectDto;
  canRefreshSummary: boolean;
  /** Switches to the Questions tab, optionally with filters already applied. */
  onOpenQuestions: (preset: Partial<QuestionFilters>) => void;
}

export function OverviewTab({ project, canRefreshSummary, onOpenQuestions }: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <section className="uab-panel" aria-label="Project details">
        <dl className="grid max-w-xl grid-cols-[8rem_1fr] gap-y-2">
          <dt className="uab-muted">Description</dt>
          <dd>{project.description ?? 'No description'}</dd>
          <dt className="uab-muted">Your role</dt>
          <dd>{project.myRole ? ROLE_LABELS[project.myRole] : 'Organization admin'}</dd>
          <dt className="uab-muted">Created</dt>
          <dd>
            <DateText value={project.createdAt} />
          </dd>
          <dt className="uab-muted">Last updated</dt>
          <dd>
            <DateText value={project.updatedAt} />
          </dd>
        </dl>
      </section>
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
