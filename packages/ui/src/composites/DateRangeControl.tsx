import { useState, useCallback, useEffect, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns';
import { cn } from '../lib/cn';
import { Button } from '../button';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { DatePickerPanel } from './DatePicker';

function parseYMD(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(dateStr: string): string {
  const date = parseYMD(dateStr);
  if (!date) return dateStr;
  return format(date, 'MMM d, yyyy');
}

interface RangePreset {
  key: string;
  label: string;
  from: string;
  to: string;
}

function buildPresets(): RangePreset[] {
  const f = (d: Date) => format(d, 'yyyy-MM-dd');
  const today = new Date();
  const w = { weekStartsOn: 1 as const };
  const yesterday = subDays(today, 1);
  const lastWeek = subWeeks(today, 1);
  const lastMonth = subMonths(today, 1);
  return [
    { key: 'today', label: 'Today', from: f(today), to: f(today) },
    { key: 'yesterday', label: 'Yesterday', from: f(yesterday), to: f(yesterday) },
    { key: 'last7', label: 'Last 7 days', from: f(subDays(today, 6)), to: f(today) },
    { key: 'this_week', label: 'This week', from: f(startOfWeek(today, w)), to: f(today) },
    { key: 'last_week', label: 'Last week', from: f(startOfWeek(lastWeek, w)), to: f(endOfWeek(lastWeek, w)) },
    { key: 'this_month', label: 'This month', from: f(startOfMonth(today)), to: f(today) },
    { key: 'last_month', label: 'Last month', from: f(startOfMonth(lastMonth)), to: f(endOfMonth(lastMonth)) },
  ];
}

interface DateRangeControlProps {
  dateFrom: string;
  dateTo: string;
  onApply: (range: { dateFrom: string; dateTo: string }) => void;
  className?: string;
  allowFuture?: boolean;
  showDates?: boolean;
}

export function DateRangeControl({
  dateFrom,
  dateTo,
  onApply,
  className,
  allowFuture = false,
  showDates = false,
}: DateRangeControlProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);

  useEffect(() => { setLocalFrom(dateFrom); }, [dateFrom]);
  useEffect(() => { setLocalTo(dateTo); }, [dateTo]);

  const maxDate = allowFuture ? undefined : new Date();

  const handleFromChange = useCallback((date: Date) => {
    setLocalFrom(format(date, 'yyyy-MM-dd'));
  }, []);

  const handleToChange = useCallback((date: Date) => {
    setLocalTo(format(date, 'yyyy-MM-dd'));
  }, []);

  const handleApplyRange = useCallback(() => {
    if (localFrom && localTo && localFrom <= localTo) {
      onApply({ dateFrom: localFrom, dateTo: localTo });
      setCalendarOpen(false);
    }
  }, [onApply, localFrom, localTo]);

  const presets = useMemo(() => buildPresets(), []);
  const activePreset = presets.find((p) => p.from === dateFrom && p.to === dateTo);
  const activePresetKey = activePreset?.key;

  const applyPreset = useCallback(
    (preset: RangePreset) => {
      onApply({ dateFrom: preset.from, dateTo: preset.to });
      setCalendarOpen(false);
    },
    [onApply],
  );

  const dateDisplayLabel =
    activePreset && !showDates
      ? activePreset.label
      : dateFrom && dateTo
        ? `${formatDisplay(dateFrom)} – ${formatDisplay(dateTo)}`
        : 'Select date range';

  return (
    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 min-w-0 max-w-[min(100%,18rem)] gap-1.5 text-lg font-medium sm:max-w-none',
            className,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span className="truncate">{dateDisplayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start" sideOffset={8} collisionPadding={16}>
        <div className="flex gap-4">
          <div className="flex w-32 shrink-0 flex-col gap-0.5 border-r pr-3">
            <p className="mb-1 text-lg font-semibold text-muted-foreground">Quick ranges</p>
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  'rounded-md px-2 py-1 text-left text-lg transition-colors hover:bg-accent',
                  activePresetKey === preset.key
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-lg font-semibold text-muted-foreground">From</p>
            <DatePickerPanel
              value={parseYMD(localFrom)}
              onChange={handleFromChange}
              maxDate={parseYMD(localTo) ?? maxDate}
              allowPast
            />
          </div>

          <div className="w-px bg-border" />

          <div>
            <p className="mb-2 text-lg font-semibold text-muted-foreground">To</p>
            <DatePickerPanel
              value={parseYMD(localTo)}
              onChange={handleToChange}
              minDate={parseYMD(localFrom) ?? undefined}
              maxDate={maxDate}
              allowPast
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" className="h-7 text-lg" onClick={() => setCalendarOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-lg"
            onClick={handleApplyRange}
            disabled={!localFrom || !localTo || localFrom > localTo}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
