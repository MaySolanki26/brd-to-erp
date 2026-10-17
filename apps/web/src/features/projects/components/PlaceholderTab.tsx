import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@brd/ui';

interface PlaceholderTabProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Tabs whose data arrives with the processing pipeline; they render a stable empty state until then. */
export function PlaceholderTab({ icon, title, description }: PlaceholderTabProps) {
  return <EmptyState icon={icon} title={title} description={description} />;
}
