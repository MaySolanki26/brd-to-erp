import { useState } from 'react';
import { MAX_ANSWER_CHARS, answerQuestionSchema } from '@brd/shared';
import { Button, Label, Textarea } from '@brd/ui';

interface AnswerFormProps {
  questionId: string;
  draft: string;
  pending: boolean;
  /** A failure from the server, other than a conflict (which is shown above the form). */
  error: string | null;
  onDraftChange: (draft: string) => void;
  onSubmit: (answer: string) => void;
  onDismiss: () => void;
}

const answerSchema = answerQuestionSchema.shape.answer;

export function AnswerForm({
  questionId,
  draft,
  pending,
  error,
  onDraftChange,
  onSubmit,
  onDismiss,
}: AnswerFormProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const fieldId = `answer-${questionId}`;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = answerSchema.safeParse(draft);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Write an answer first');
      return;
    }
    setProblem(null);
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <Label htmlFor={fieldId}>Your answer</Label>
      <Textarea
        id={fieldId}
        rows={3}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        aria-invalid={problem !== null}
        aria-describedby={`${fieldId}-help`}
      />
      <p
        id={`${fieldId}-help`}
        className={`text-xs ${draft.length > MAX_ANSWER_CHARS ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {draft.length.toLocaleString()} / {MAX_ANSWER_CHARS.toLocaleString()} characters
      </p>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Submit answer'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onDismiss}>
          Dismiss question
        </Button>
      </div>
    </form>
  );
}
