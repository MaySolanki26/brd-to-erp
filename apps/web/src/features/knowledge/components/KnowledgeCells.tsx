import type { KnowledgeSourceDto, PersonRef } from '@brd/shared';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@brd/ui';
import { formatDate } from '@/features/projects/project-labels';
import { SourceLink } from './SourceLink';

export function TitleCell({ title, description }: { title: string; description: string | null }) {
  return (
    <div className="max-w-md">
      <p className="font-medium">{title}</p>
      {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function AuthorCell({ createdBy }: { createdBy: 'AI' | PersonRef }) {
  return <span>{createdBy === 'AI' ? 'AI extraction' : createdBy.name}</span>;
}

export function SourceCell({
  source,
  otherSources,
  onOpen,
}: {
  source: KnowledgeSourceDto;
  /** Other chunks that state the same thing; the item was merged from them. */
  otherSources: KnowledgeSourceDto[];
  onOpen: (chunkId: string) => void;
}) {
  const extra = otherSources.length;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <SourceLink source={source} onOpen={onOpen} />
      {extra > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto p-0"
              onClick={(event) => event.stopPropagation()}
            >
              {extra === 1 ? '+1 more source' : `+${String(extra)} more sources`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-1.5 p-3">
            <p className="text-sm font-medium">Also found in</p>
            {otherSources.map((other) => (
              <div key={other.chunkId}>
                <SourceLink source={other} onOpen={onOpen} />
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function DateCell({ iso }: { iso: string }) {
  return <span className="whitespace-nowrap">{formatDate(iso)}</span>;
}

export function ModuleCell({ module }: { module: { id: string; name: string } | null }) {
  return module ? <span>{module.name}</span> : <span className="text-muted-foreground">—</span>;
}
