import { ArrowRight } from 'lucide-react';
import type { DecisionChangeDto } from '@brd/shared';
import { Badge, StatusBadge } from '@brd/ui';
import { STATUS_LABELS, STATUS_TONES } from '@/features/knowledge/knowledge-labels';
import { KIND_LABELS } from '@/features/questions/question-labels';

function hasChanged(change: DecisionChangeDto): boolean {
  return (
    change.before.status !== change.after.status ||
    change.before.title !== change.after.title ||
    (change.before.description ?? '') !== (change.after.description ?? '')
  );
}

/** One affected item: what it was, what it is now, and why. */
export function ChangeRow({ change }: { change: DecisionChangeDto }) {
  const statusChanged = change.before.status !== change.after.status;
  const titleChanged = change.before.title !== change.after.title;
  const descriptionChanged = (change.before.description ?? '') !== (change.after.description ?? '');

  return (
    <li className="uab-panel flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{KIND_LABELS[change.kind]}</Badge>
        <span className="font-medium">{change.title}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Status before and after">
        <StatusBadge
          label={STATUS_LABELS[change.before.status]}
          tone={STATUS_TONES[change.before.status]}
        />
        {statusChanged ? (
          <>
            <ArrowRight className="h-3 w-3 text-muted-foreground" aria-label="became" />
            <StatusBadge
              label={STATUS_LABELS[change.after.status]}
              tone={STATUS_TONES[change.after.status]}
            />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Status unchanged</span>
        )}
        {!hasChanged(change) && <Badge variant="secondary">No change</Badge>}
      </div>

      {titleChanged && (
        <p className="text-xs">
          <span className="text-muted-foreground">Title: </span>
          <span className="line-through">{change.before.title}</span>
          <ArrowRight className="mx-1 inline h-3 w-3" aria-label="became" />
          <span>{change.after.title}</span>
        </p>
      )}

      {descriptionChanged && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Description changed</summary>
          <p className="mt-1 whitespace-pre-wrap line-through">
            {change.before.description ?? '(none)'}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{change.after.description ?? '(none)'}</p>
        </details>
      )}

      {change.reason && <p className="text-xs text-muted-foreground">{change.reason}</p>}
    </li>
  );
}
