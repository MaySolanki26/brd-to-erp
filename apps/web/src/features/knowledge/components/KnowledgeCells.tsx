import { useRef, useState } from 'react';
import type { KnowledgeSourceDto, PersonRef } from '@brd/shared';
import { Button, DateText, EmptyValue, Popover, TruncatedText } from '@brd/ui';
import { SourceLink } from './SourceLink';

/** One line; the full title appears on hover when it is cut off. The description has its own column. */
export function TitleCell({ title }: { title: string }) {
  return (
    <div className="max-w-md min-w-0">
      <TruncatedText text={title} className="font-medium" />
    </div>
  );
}

export function DescriptionCell({ description }: { description: string | null }) {
  if (!description) return <EmptyValue />;
  return (
    <div className="max-w-md min-w-0 text-muted-foreground">
      <TruncatedText text={description} />
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
      {extra > 0 && <MoreSources others={otherSources} onOpen={onOpen} />}
    </div>
  );
}

function MoreSources({
  others,
  onOpen,
}: {
  others: KnowledgeSourceDto[];
  onOpen: (chunkId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const count = others.length;
  return (
    <>
      <Button
        ref={anchor}
        type="button"
        variant="link"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        {count === 1 ? '+1 more source' : `+${String(count)} more sources`}
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        label="Also found in"
        width={288}
      >
        <div className="uab-pop-head">
          <strong>Also found in</strong>
        </div>
        <div className="uab-pop-body">
          {others.map((other) => (
            <div key={other.chunkId}>
              <SourceLink source={other} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}

export function DateCell({ iso }: { iso: string }) {
  return <DateText value={iso} />;
}

export function ModuleCell({ module }: { module: { id: string; name: string } | null }) {
  return module ? <span>{module.name}</span> : <EmptyValue />;
}
