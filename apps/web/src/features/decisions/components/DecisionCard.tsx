import { TriangleAlert } from 'lucide-react';
import type { DecisionDto } from '@brd/shared';
import { Badge } from '@brd/ui';
import { KIND_LABELS } from '@/features/questions/question-labels';
import { formatDateTime } from '../format';
import { ChangeRow } from './ChangeRow';

/** One entry of the timeline: who decided what, when, and what it touched. */
export function DecisionCard({ decision }: { decision: DecisionDto }) {
  return (
    <li className="relative pb-8 pl-6 last:pb-0">
      <span
        aria-hidden
        className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background"
      />
      <article aria-label={`Decision on: ${decision.question.text}`} className="space-y-3">
        <header className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{decision.decidedBy.name}</span>
          <time dateTime={decision.decidedAt} className="text-muted-foreground">
            {formatDateTime(decision.decidedAt)}
          </time>
        </header>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Question</p>
          <p className="text-sm">{decision.question.text}</p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Answer</p>
          <p className="uab-inline-alert uab-tone-neutral whitespace-pre-wrap">{decision.answer}</p>
        </div>

        {decision.summary && <p className="text-sm font-medium">{decision.summary}</p>}

        {decision.changes.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Affected items</p>
            <ul className="space-y-2">
              {decision.changes.map((change) => (
                <ChangeRow key={`${change.kind}:${change.id}`} change={change} />
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This answer did not change any items.</p>
        )}

        {decision.conflicts.length > 0 && (
          <div
            role="group"
            aria-label="Conflicts"
            className="uab-inline-alert uab-tone-warning flex flex-col gap-1"
          >
            <p className="flex items-center gap-1 font-medium">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              Contradicts confirmed items, left unchanged
            </p>
            <ul className="space-y-1">
              {decision.conflicts.map((conflict) => (
                <li key={`${conflict.kind}:${conflict.id}`}>
                  <Badge variant="outline" className="mr-2">
                    {KIND_LABELS[conflict.kind]}
                  </Badge>
                  {conflict.title && <span className="font-medium">{conflict.title}: </span>}
                  {conflict.explanation}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </li>
  );
}
