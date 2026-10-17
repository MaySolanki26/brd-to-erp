import { Badge } from '@brd/ui';
import { useQuestionCounts } from '../hooks/use-questions';

/** "Questions" with the number still open; just the word while loading or if the count fails. */
export function QuestionsTabLabel({ projectId }: { projectId: string }) {
  const counts = useQuestionCounts(projectId);
  const open = counts.data?.byStatus.OPEN ?? 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      Questions
      {open > 0 && (
        <Badge variant={counts.data && counts.data.openCritical > 0 ? 'destructive' : 'secondary'}>
          <span className="sr-only">{open} open: </span>
          {open}
        </Badge>
      )}
    </span>
  );
}
