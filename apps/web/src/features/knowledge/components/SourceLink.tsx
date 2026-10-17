import { FileText, StickyNote } from 'lucide-react';
import type { KnowledgeSourceDto } from '@brd/shared';
import { sourceLabel } from '../knowledge-labels';

interface SourceLinkProps {
  source: KnowledgeSourceDto;
  onOpen: (chunkId: string) => void;
}

/** Opens the exact chunk the item was taken from. */
export function SourceLink({ source, onOpen }: SourceLinkProps) {
  const Icon = source.type === 'document' ? FileText : StickyNote;
  const section = source.headingPath.at(-1);
  return (
    <button
      type="button"
      className="inline-flex max-w-xs items-center gap-1.5 text-left text-sm text-primary hover:underline"
      aria-label={`View source: ${sourceLabel(source)}${section ? `, ${section}` : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(source.chunkId);
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">
        {sourceLabel(source)}
        {section && <span className="text-muted-foreground"> · {section}</span>}
      </span>
    </button>
  );
}
