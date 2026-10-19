import { useMemo, useState } from 'react';
import { HelpCircle, PartyPopper, SearchX } from 'lucide-react';
import { QUESTION_STATUSES } from '@brd/shared';
import { Button, CardListSkeleton, EmptyState, NoAccess, PageError } from '@brd/ui';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { groupQuestions } from '../group-questions';
import { useQuestionFilters } from '../hooks/use-question-filters';
import { useRefreshQuestions } from '../hooks/use-question-mutations';
import { useQuestionCounts, useQuestions } from '../hooks/use-questions';
import { QuestionFilters } from './QuestionFilters';
import { QuestionGroup } from './QuestionGroup';
import { UnsentAnswers, type UnsentAnswer } from './UnsentAnswers';

interface QuestionsTabProps {
  projectId: string;
  canAnswer: boolean;
}

export function QuestionsTab({ projectId, canAnswer }: QuestionsTabProps) {
  const { filters, change, reset, activeCount } = useQuestionFilters();
  const questions = useQuestions(projectId, filters);
  const counts = useQuestionCounts(projectId);
  const refresh = useRefreshQuestions(projectId);
  const [unsent, setUnsent] = useState<UnsentAnswer[]>([]);

  const loaded = useMemo(
    () => questions.data?.pages.flatMap((page) => page.items) ?? [],
    [questions.data],
  );
  const total = questions.data?.pages[0]?.total ?? 0;
  // The newest page's counts: they describe the whole result, whichever page is showing.
  const moduleCounts = questions.data?.pages.at(-1)?.moduleCounts;
  const groups = useMemo(() => groupQuestions(loaded, moduleCounts), [loaded, moduleCounts]);

  if (questions.isError && isForbidden(questions.error)) {
    return <NoAccess description="You do not have access to this project's questions." />;
  }

  const rememberUnsent = (item: UnsentAnswer) =>
    setUnsent((current) => [...current.filter((u) => u.questionId !== item.questionId), item]);

  const totalQuestions = counts.data
    ? QUESTION_STATUSES.reduce((sum, status) => sum + counts.data.byStatus[status], 0)
    : null;

  const renderEmpty = () => {
    if (totalQuestions === 0) {
      return (
        <EmptyState
          icon={HelpCircle}
          title="No questions yet"
          description="Clarification questions appear here once your sources have been analysed."
        />
      );
    }
    if (activeCount === 0) {
      return (
        <EmptyState
          icon={PartyPopper}
          title="All caught up"
          description="There are no open questions right now."
        />
      );
    }
    return (
      <EmptyState
        icon={SearchX}
        title="No questions match these filters"
        description="Try other filters, or reset them to see the open questions."
        action={
          <Button size="sm" variant="outline" onClick={reset}>
            Reset filters
          </Button>
        }
      />
    );
  };

  return (
    <div className="uab-page flex flex-col gap-4">
      <QuestionFilters
        filters={filters}
        activeCount={activeCount}
        onChange={change}
        onReset={reset}
        summary={
          counts.data
            ? `${String(counts.data.byStatus.OPEN)} open${counts.data.openCritical > 0 ? ` · ${String(counts.data.openCritical)} critical` : ''}`
            : undefined
        }
      />

      <UnsentAnswers
        items={unsent}
        onDiscard={(id) => setUnsent((current) => current.filter((u) => u.questionId !== id))}
      />

      {questions.isPending && <CardListSkeleton rows={3} />}
      {questions.isError && (
        <PageError
          message="Could not load questions"
          description={errorMessage(questions.error)}
          onRetry={() => void questions.refetch()}
        />
      )}
      {questions.isSuccess && groups.length === 0 && renderEmpty()}
      {questions.isSuccess && groups.length > 0 && (
        <div className="space-y-8">
          {groups.map((group) => (
            <QuestionGroup
              key={group.key}
              projectId={projectId}
              group={group}
              canAnswer={canAnswer}
              refreshing={questions.isFetching}
              onRefresh={() => void refresh()}
              onConflict={rememberUnsent}
            />
          ))}
          {questions.hasNextPage && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={questions.isFetchingNextPage}
                onClick={() => void questions.fetchNextPage()}
              >
                {questions.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
              <span className="text-sm text-muted-foreground">
                Showing {loaded.length} of {total}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
