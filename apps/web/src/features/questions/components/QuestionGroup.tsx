import { useId } from 'react';
import { Badge } from '@brd/ui';
import type { QuestionGroup as Group } from '../group-questions';
import { QuestionCard } from './QuestionCard';
import type { UnsentAnswer } from './UnsentAnswers';

interface QuestionGroupProps {
  projectId: string;
  group: Group;
  canAnswer: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onConflict: (unsent: UnsentAnswer) => void;
}

export function QuestionGroup({
  projectId,
  group,
  canAnswer,
  refreshing,
  onRefresh,
  onConflict,
}: QuestionGroupProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 id={headingId} className="text-lg font-semibold">
          {group.title}
        </h3>
        <Badge variant="secondary">{group.questions.length}</Badge>
      </div>
      <div className="space-y-3">
        {group.questions.map((question) => (
          <QuestionCard
            key={question.id}
            projectId={projectId}
            question={question}
            canAnswer={canAnswer}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onConflict={onConflict}
          />
        ))}
      </div>
    </section>
  );
}
