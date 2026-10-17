import { Badge, StatusBadge } from '@brd/ui';
import type { LinkedItemDto } from '@brd/shared';
import { STATUS_LABELS, STATUS_TONES } from '@/features/knowledge/knowledge-labels';
import { KIND_LABELS } from '../question-labels';

/** The items an answer would affect, shown on the question so the person knows what they decide. */
export function LinkedItems({ items }: { items: LinkedItemDto[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">About</p>
      <ul aria-label="Linked items" className="space-y-1">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{KIND_LABELS[item.kind]}</Badge>
            <span className="font-medium">{item.title}</span>
            <StatusBadge
              label={STATUS_LABELS[item.status]}
              tone={STATUS_TONES[item.status]}
              size="xs"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
