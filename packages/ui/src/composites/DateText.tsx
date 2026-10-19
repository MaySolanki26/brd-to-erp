import { formatDateLong, formatDateShort, hasTimeOfDay, parseDateValue } from '../lib/date-format';
import { EmptyValue } from './EmptyValue';

export interface DateTextProps {
  value: string | Date | null | undefined;
}

/** Shows "16 Oct, 2026"; the full value ("Fri, 16 Oct 2026 08:30 AM") appears on hover and focus. */
export function DateText({ value }: DateTextProps) {
  if (value === null || value === undefined || value === '') return <EmptyValue />;
  const date = parseDateValue(value);
  if (!date) return <EmptyValue />;

  return (
    <time
      className="uab-date-text"
      dateTime={date.toISOString()}
      data-tooltip={formatDateLong(date, hasTimeOfDay(value))}
      tabIndex={0}
    >
      {formatDateShort(date)}
    </time>
  );
}
