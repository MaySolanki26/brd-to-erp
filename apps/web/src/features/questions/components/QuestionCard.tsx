import { useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import type { QuestionDto } from '@brd/shared';
import { Badge, StatusBadge, toast } from '@brd/ui';
import { ApiClientError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { formatDate } from '@/features/projects/project-labels';
import { useAnswerQuestion, useDismissQuestion } from '../hooks/use-question-mutations';
import {
  PRIORITY_LABELS,
  PRIORITY_TONES,
  QUESTION_STATUS_LABELS,
  REASON_LABELS,
} from '../question-labels';
import { AnswerForm } from './AnswerForm';
import { ConflictNotice } from './ConflictNotice';
import { DismissDialog } from './DismissDialog';
import { LinkedItems } from './LinkedItems';
import type { UnsentAnswer } from './UnsentAnswers';

interface QuestionCardProps {
  projectId: string;
  question: QuestionDto;
  canAnswer: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  /** Called with the person's text when someone else resolved the question first. */
  onConflict: (unsent: UnsentAnswer) => void;
}

const isConflict = (err: unknown): err is ApiClientError =>
  err instanceof ApiClientError && err.status === 409;

export function QuestionCard({
  projectId,
  question,
  canAnswer,
  refreshing,
  onRefresh,
  onConflict,
}: QuestionCardProps) {
  const answer = useAnswerQuestion(projectId);
  const dismiss = useDismissQuestion(projectId);

  const [draft, setDraft] = useState('');
  const [dismissOpen, setDismissOpen] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState<string | null>(null);

  const open = question.status === 'OPEN';

  const keepDraft = (message: string) => {
    setConflict(message);
    if (draft.trim()) {
      onConflict({ questionId: question.id, questionText: question.text, text: draft });
    }
  };

  const submitAnswer = (text: string) => {
    setAnswerError(null);
    setConflict(null);
    answer.mutate(
      { questionId: question.id, answer: text, version: question.version },
      {
        onSuccess: () => {
          setDraft('');
          toast.success('Answer saved. It will be applied to the linked items shortly.');
        },
        onError: (err) => {
          if (isConflict(err)) {
            setConflict(err.message);
            onConflict({ questionId: question.id, questionText: question.text, text });
          } else {
            setAnswerError(errorMessage(err));
          }
        },
      },
    );
  };

  const submitDismissal = (reason: string) => {
    setDismissError(null);
    setConflict(null);
    dismiss.mutate(
      { questionId: question.id, reason, version: question.version },
      {
        onSuccess: () => {
          setDismissOpen(false);
          toast.success('Question dismissed');
        },
        onError: (err) => {
          if (isConflict(err)) {
            setDismissOpen(false);
            keepDraft(err.message);
          } else {
            setDismissError(errorMessage(err));
          }
        },
      },
    );
  };

  return (
    <article
      aria-label={question.text}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={PRIORITY_LABELS[question.priority]}
          tone={PRIORITY_TONES[question.priority]}
          size="xs"
        />
        <Badge variant="outline">{REASON_LABELS[question.reason]}</Badge>
        {!open && <Badge variant="secondary">{QUESTION_STATUS_LABELS[question.status]}</Badge>}
        {question.followUpOf && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="h-3 w-3" aria-hidden />
            Follow-up
          </span>
        )}
      </div>

      <p className="text-base font-medium">{question.text}</p>

      <LinkedItems projectId={projectId} items={question.linkedItems} />

      {question.answer && (
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Answered by {question.answer.answeredBy.name} on{' '}
            {formatDate(question.answer.answeredAt)}
            {!question.answer.applied && ' · being applied to the linked items'}
          </p>
          <p className="whitespace-pre-wrap">{question.answer.text}</p>
        </div>
      )}

      {question.dismissal && (
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Dismissed on {formatDate(question.dismissal.at)}
          </p>
          <p className="whitespace-pre-wrap">{question.dismissal.reason}</p>
        </div>
      )}

      {conflict && (
        <ConflictNotice
          message={conflict}
          refreshing={refreshing}
          onRefresh={() => {
            setConflict(null);
            onRefresh();
          }}
        />
      )}

      {open && canAnswer && (
        <AnswerForm
          questionId={question.id}
          draft={draft}
          pending={answer.isPending}
          error={answerError}
          onDraftChange={setDraft}
          onSubmit={submitAnswer}
          onDismiss={() => {
            setDismissError(null);
            setDismissOpen(true);
          }}
        />
      )}

      {open && !canAnswer && (
        <p className="text-sm text-muted-foreground">
          Waiting for an answer. Only analysts and owners can answer questions.
        </p>
      )}

      <DismissDialog
        open={dismissOpen}
        questionText={question.text}
        pending={dismiss.isPending}
        error={dismissError}
        onOpenChange={setDismissOpen}
        onConfirm={submitDismissal}
      />
    </article>
  );
}
