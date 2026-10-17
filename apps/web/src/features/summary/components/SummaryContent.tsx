import { TriangleAlert } from 'lucide-react';
import type { SummaryDto } from '@brd/shared';
import { Badge } from '@brd/ui';
import { KIND_LABELS } from '@/features/questions/question-labels';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function builtFrom(basedOn: Record<string, number>): string | null {
  const parts = Object.entries(basedOn).map(([name, count]) => `${String(count)} ${name}`);
  return parts.length > 0 ? `Built from ${parts.join(', ')}.` : null;
}

export function SummaryContent({ summary }: { summary: SummaryDto }) {
  const { content } = summary;
  const source = builtFrom(summary.basedOn);

  return (
    <div className="space-y-5">
      <Section title="Overview">
        <p className="text-sm">{content.overview || 'No overview yet.'}</p>
      </Section>

      {content.modules.length > 0 && (
        <Section title="Modules">
          <ul className="space-y-1 text-sm">
            {content.modules.map((module) => (
              <li key={module.id}>
                <span className="font-medium">{module.name}</span>
                <span className="text-muted-foreground"> — {module.summary}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {content.keyRequirements.length > 0 && (
        <Section title="Key requirements">
          <ul className="space-y-1 text-sm">
            {content.keyRequirements.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground"> — {item.why}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {content.keyRules.length > 0 && (
        <Section title="Key rules">
          <ul className="space-y-1 text-sm">
            {content.keyRules.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground"> — {item.why}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {content.assumptions.length > 0 && (
        <Section title="Assumptions">
          <ul className="space-y-1 text-sm">
            {content.assumptions.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <Badge variant="outline" className="mr-2">
                  {KIND_LABELS[item.kind]}
                </Badge>
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground"> — {item.statement}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {content.staleItems.length > 0 && (
        <Section title="Needs a second look">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Their source changed, so they are not relied on until someone checks them.
          </p>
          <ul className="space-y-1 text-sm">
            {content.staleItems.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <Badge variant="outline" className="mr-2">
                  {KIND_LABELS[item.kind]}
                </Badge>
                {item.title}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {source && <p className="text-xs text-muted-foreground">{source}</p>}
    </div>
  );
}
