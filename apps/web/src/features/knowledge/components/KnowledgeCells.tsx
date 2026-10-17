import type { KnowledgeSourceDto, PersonRef } from '@brd/shared';
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
  onOpen,
}: {
  source: KnowledgeSourceDto;
  onOpen: (chunkId: string) => void;
}) {
  return <SourceLink source={source} onOpen={onOpen} />;
}

export function DateCell({ iso }: { iso: string }) {
  return <span className="whitespace-nowrap">{formatDate(iso)}</span>;
}

export function ModuleCell({ module }: { module: { id: string; name: string } | null }) {
  return module ? <span>{module.name}</span> : <span className="text-muted-foreground">—</span>;
}
