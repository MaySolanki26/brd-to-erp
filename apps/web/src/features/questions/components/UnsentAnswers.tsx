import { Copy, X } from 'lucide-react';
import { Button, toast } from '@brd/ui';

export interface UnsentAnswer {
  questionId: string;
  questionText: string;
  text: string;
}

interface UnsentAnswersProps {
  items: UnsentAnswer[];
  onDiscard: (questionId: string) => void;
}

/**
 * Text people wrote for a question that someone else resolved first. It stays here after the
 * list refreshes (the question may have left the filtered list) so nothing they wrote is lost.
 */
export function UnsentAnswers({ items, onDiscard }: UnsentAnswersProps) {
  if (items.length === 0) return null;

  const copy = async (text: string) => {
    const copied = await navigator.clipboard?.writeText(text).then(
      () => true,
      () => false,
    );
    if (copied) toast.success('Copied your text');
    else toast.error('Could not copy. Select the text and copy it instead.');
  };

  return (
    <section
      aria-label="Your unsent answers"
      className="space-y-2 rounded-md border border-dashed border-warning/60 bg-warning/5 p-3"
    >
      <h3 className="text-sm font-medium">Your unsent answers</h3>
      <p className="text-xs text-muted-foreground">
        These questions were resolved by someone else before you could send them.
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.questionId} className="rounded bg-surface p-2 text-sm">
            <p className="text-xs text-muted-foreground">{item.questionText}</p>
            <p className="whitespace-pre-wrap">{item.text}</p>
            <div className="mt-1 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label={`Copy your text for: ${item.questionText}`}
                onClick={() => void copy(item.text)}
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Discard your text for: ${item.questionText}`}
                onClick={() => onDiscard(item.questionId)}
              >
                <X className="mr-1 h-3 w-3" />
                Discard
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
