import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../lib/cn';
import { Input } from '../input';
import { Button } from '../button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'default';
  expandable?: boolean;
  expandedWidthClassName?: string;
  tooltip?: string;
  debounce?: number;
  'aria-label'?: string;
  autoFocus?: boolean;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  inputClassName,
  size = 'default',
  expandable = false,
  expandedWidthClassName = 'w-48',
  tooltip,
  debounce = 300,
  'aria-label': ariaLabel,
  autoFocus,
  onBlur,
  onKeyDown,
}: SearchInputProps) {
  const compact = size === 'sm';
  const label = ariaLabel ?? placeholder;
  const tooltipLabel = tooltip ?? 'Search';
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const [inner, setInner] = useState(value);
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setInner(value);
    }
  }, [value]);

  useEffect(() => {
    if (inner === lastEmitted.current) return;
    if (debounce <= 0) {
      lastEmitted.current = inner;
      onChangeRef.current(inner);
      return;
    }
    const t = setTimeout(() => {
      lastEmitted.current = inner;
      onChangeRef.current(inner);
    }, debounce);
    return () => clearTimeout(t);
  }, [inner, debounce]);

  const commitNow = (next: string) => {
    lastEmitted.current = next;
    setInner(next);
    onChangeRef.current(next);
  };

  const focusHighlight =
    'focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring/40 focus-visible:border-ring/60';

  if (expandable) {
    const open = focused || inner.length > 0;

    return (
      <div
        className={cn(
          'bg-surface flex items-center overflow-hidden rounded-md border transition-[width,border-color,box-shadow]',
          open
            ? cn(
                expandedWidthClassName,
                'border-border focus-within:ring-1 focus-within:ring-offset-0 focus-within:ring-ring/40 focus-within:border-ring/60',
              )
            : 'w-8 border-transparent',
          className,
        )}
      >
        {open ? (
          <>
            <Search
              className="text-muted-foreground ml-2 h-3.5 w-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            <Input
              ref={inputRef}
              type="text"
              value={inner}
              onChange={(e) => setInner(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              aria-label={label}
              autoFocus
              className="h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 text-lg focus-visible:ring-0"
            />
            {inner && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                className="mr-0.5 h-6 w-6 shrink-0"
                onClick={() => commitNow('')}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
            )}
          </>
        ) : (
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  onClick={() => {
                    setFocused(true);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center"
                >
                  <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {tooltipLabel}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(
          'text-muted-foreground absolute top-1/2 -translate-y-1/2',
          compact ? 'left-2 h-3 w-3' : 'left-3 h-4 w-4',
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      <Input
        type="text"
        value={inner}
        onChange={(e) => setInner(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={cn(
          focusHighlight,
          compact ? 'h-6 pl-6 pr-7 text-sm md:text-sm' : 'pl-9 pr-9',
          inputClassName,
        )}
      />
      {inner && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          className={cn(
            'absolute top-1/2 -translate-y-1/2',
            compact ? 'right-0.5 h-5 w-5' : 'right-1 h-7 w-7',
          )}
          onClick={() => commitNow('')}
        >
          <X className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}
