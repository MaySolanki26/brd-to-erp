import type { SourceStatus } from '@brd/shared';
import { StatusBadge } from '@brd/ui';
import { SOURCE_STATUS_LABELS, SOURCE_STATUS_TONES } from '../source-utils';

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return <StatusBadge label={SOURCE_STATUS_LABELS[status]} tone={SOURCE_STATUS_TONES[status]} />;
}
