import { useState, useCallback, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  format,
  isToday as isTodayFn,
  isPast as isPastFn,
  startOfDay,
  getDaysInMonth,
  getDay,
  isBefore,
  isAfter,
} from 'date-fns';
import { cn } from '../lib/cn';
import { Button } from '../button';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';

interface CalendarGridProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  allowPast?: boolean;
  captionLayout?: 'label' | 'dropdown';
  getDayIndicator?: (date: Date) => DayIndicator | null;
}

export interface DayIndicator {
  className: string;
  label: string;
}

const CAPTION_MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i, 1), 'MMMM'),
);

function CaptionDropdowns({
  viewMonth,
  onViewMonthChange,
  minDate,
  maxDate,
}: {
  viewMonth: Date;
  onViewMonthChange: (month: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const currentYear = new Date().getFullYear();
  const fromYear = Math.min(
    minDate?.getFullYear() ?? currentYear - 100,
    viewMonth.getFullYear(),
  );
  const toYear = Math.max(
    maxDate?.getFullYear() ?? currentYear + 10,
    viewMonth.getFullYear(),
  );
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);

  const triggerCls =
    'h-auto w-auto gap-0.5 rounded border-0 bg-transparent px-1 py-0.5 text-xl font-semibold text-foreground hover:bg-muted [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground [&>svg]:opacity-100';

  return (
    <div className="flex items-center">
      <Select
        value={String(viewMonth.getMonth())}
        onValueChange={(v) =>
          onViewMonthChange(new Date(viewMonth.getFullYear(), Number(v), 1))
        }
      >
        <SelectTrigger aria-label="Month" className={triggerCls}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CAPTION_MONTH_LABELS.map((label, i) => (
            <SelectItem key={label} value={String(i)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(viewMonth.getFullYear())}
        onValueChange={(v) =>
          onViewMonthChange(new Date(Number(v), viewMonth.getMonth(), 1))
        }
      >
        <SelectTrigger aria-label="Year" className={triggerCls}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function CalendarGrid({
  value,
  viewMonth,
  onSelect,
  onPrevMonth,
  onNextMonth,
  onViewMonthChange,
  minDate,
  maxDate,
  allowPast = false,
  captionLayout = 'label',
  getDayIndicator,
}: CalendarGridProps & {
  viewMonth: Date;
  onSelect: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onViewMonthChange: (month: Date) => void;
}) {
  const totalDays = getDaysInMonth(viewMonth);
  const firstDayOfWeek = (getDay(startOfMonth(viewMonth)) + 6) % 7;

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        {captionLayout === 'dropdown' ? (
          <CaptionDropdowns
            viewMonth={viewMonth}
            onViewMonthChange={onViewMonthChange}
            minDate={minDate}
            maxDate={maxDate}
          />
        ) : (
          <span className="text-xl font-semibold text-foreground">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
        )}
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="pb-1 text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
          const isSelected = value ? isSameDay(date, value) : false;
          const isCurrentMonth = isSameMonth(date, viewMonth);
          const isToday = isTodayFn(date);
          const isPast = isPastFn(startOfDay(date)) && !isToday;
          const isBeforeMin = minDate && isBefore(startOfDay(date), startOfDay(minDate));
          const isAfterMax = maxDate && isAfter(startOfDay(date), startOfDay(maxDate));
          const isDisabled = !isCurrentMonth || !!isBeforeMin || !!isAfterMax;
          const indicator = getDayIndicator?.(date) ?? null;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(date)}
              disabled={isDisabled}
              aria-label={
                indicator ? `${format(date, 'd MMMM yyyy')}, ${indicator.label}` : undefined
              }
              className={cn(
                'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors',
                indicator && 'relative',
                isDisabled
                  ? 'cursor-not-allowed text-muted-foreground/30'
                  : isSelected
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : isToday
                      ? 'font-semibold text-primary ring-1 ring-primary'
                      : isPast && !allowPast
                        ? 'text-muted-foreground/40'
                        : 'text-foreground hover:bg-muted',
              )}
            >
              {day}
              {indicator && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                    indicator.className,
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  showRelativeLabels?: boolean;
  minDate?: Date;
  maxDate?: Date;
  allowPast?: boolean;
  disabled?: boolean;
  triggerClassName?: string;
  displayFormat?: string;
  format?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
  id?: string;
  captionLayout?: 'label' | 'dropdown';
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick date',
  showRelativeLabels = true,
  minDate,
  maxDate,
  allowPast = false,
  disabled = false,
  triggerClassName,
  displayFormat,
  format: formatAlias,
  className,
  align = 'start',
  id,
  captionLayout = 'label',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const fmt = displayFormat ?? formatAlias ?? 'EEE, MMM d';
  const triggerCls = triggerClassName ?? className;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value ?? new Date()));

  const handleSelect = useCallback(
    (date: Date) => {
      onChange(date);
      setOpen(false);
    },
    [onChange],
  );

  const handlePrevMonth = useCallback(() => {
    setViewMonth((m) => subMonths(m, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((m) => addMonths(m, 1));
  }, []);

  const handleViewMonthChange = useCallback((month: Date) => {
    setViewMonth(startOfMonth(month));
  }, []);

  const displayLabel = value
    ? showRelativeLabels && isRelativeLabel(value)
      ? getRelativeLabel(value)
      : format(value, fmt)
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          size="xs"
          disabled={disabled}
          className={cn(
            'h-8 gap-1.5 text-lg font-medium',
            'hover:border-primary/30 hover:bg-primary/5',
            'focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring/40 focus-visible:border-ring/60',
            value ? 'hover:text-foreground' : 'text-muted-foreground hover:text-muted-foreground',
            !value && 'text-muted-foreground',
            triggerCls,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align={align} sideOffset={8} collisionPadding={16}>
        <CalendarGrid
          value={value}
          viewMonth={viewMonth}
          onSelect={handleSelect}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onViewMonthChange={handleViewMonthChange}
          minDate={minDate}
          maxDate={maxDate}
          allowPast={allowPast}
          captionLayout={captionLayout}
          onChange={onChange}
        />
      </PopoverContent>
    </Popover>
  );
}

interface DatePickerPanelProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  allowPast?: boolean;
  className?: string;
  captionLayout?: 'label' | 'dropdown';
  getDayIndicator?: (date: Date) => DayIndicator | null;
  onViewMonthChange?: (month: Date) => void;
}

export function DatePickerPanel({
  value,
  onChange,
  minDate,
  maxDate,
  allowPast = false,
  className,
  captionLayout = 'label',
  getDayIndicator,
  onViewMonthChange,
}: DatePickerPanelProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value ?? new Date()));

  useEffect(() => {
    onViewMonthChange?.(viewMonth);
  }, [viewMonth, onViewMonthChange]);

  const handlePrevMonth = useCallback(() => {
    setViewMonth((m) => subMonths(m, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((m) => addMonths(m, 1));
  }, []);

  const handleViewMonthChange = useCallback((month: Date) => {
    setViewMonth(startOfMonth(month));
  }, []);

  return (
    <div className={cn('w-[240px]', className)}>
      <CalendarGrid
        value={value}
        viewMonth={viewMonth}
        onSelect={onChange}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onViewMonthChange={handleViewMonthChange}
        minDate={minDate}
        maxDate={maxDate}
        allowPast={allowPast}
        captionLayout={captionLayout}
        getDayIndicator={getDayIndicator}
        onChange={onChange}
      />
    </div>
  );
}

interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  allowPast?: boolean;
  align?: 'start' | 'center' | 'end';
  id?: string;
  captionLayout?: 'label' | 'dropdown';
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className,
  minDate,
  maxDate,
  allowPast = false,
  align = 'start',
  id,
  captionLayout = 'label',
}: DatePickerInputProps) {
  const dateValue = value ? parseYMD(value) : null;

  const handleChange = useCallback(
    (date: Date) => {
      onChange(format(date, 'yyyy-MM-dd'));
    },
    [onChange],
  );

  return (
    <DatePicker
      value={dateValue}
      onChange={handleChange}
      placeholder={placeholder}
      showRelativeLabels={false}
      displayFormat="MMM d, yyyy"
      disabled={disabled}
      triggerClassName={className}
      minDate={minDate}
      maxDate={maxDate}
      allowPast={allowPast}
      align={align}
      id={id}
      captionLayout={captionLayout}
    />
  );
}

function parseYMD(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isRelativeLabel(date: Date): boolean {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays === 0 || diffDays === 1;
}

function getRelativeLabel(date: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}
