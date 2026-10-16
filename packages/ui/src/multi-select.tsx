import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';

import { cn } from './lib/cn';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Badge } from './badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  searchableText?: string;
  [key: string]: unknown;
}

export interface MultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: string;
  renderOption?: (option: MultiSelectOption, isSelected: boolean) => React.ReactNode;
  renderTrigger?: (selectedOptions: MultiSelectOption[]) => React.ReactNode;
  mode?: 'badge' | 'count';
  maxBadges?: number;
}

export function MultiSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyText = 'No items found.',
  className,
  disabled = false,
  maxHeight = '300px',
  renderOption,
  renderTrigger,
  mode = 'count',
  maxBadges = 3,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [triggerWidth, setTriggerWidth] = React.useState<number>(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Width measurement - measure trigger width when popover opens
  React.useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lowerSearch) ||
        opt.searchableText?.toLowerCase().includes(lowerSearch),
    );
  }, [options, search]);

  // Selected options for display
  const selectedOptions = React.useMemo(() => {
    return options.filter((opt) => value.includes(opt.value));
  }, [options, value]);

  // Toggle selection
  const toggleOption = React.useCallback(
    (optionValue: string) => {
      const newValue = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue];
      onValueChange(newValue);
      setSearch('');
      // Keep the dropdown open for fast multi-picking.
      setOpen(true);
    },
    [value, onValueChange],
  );

  // Clear all
  const clearAll = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onValueChange([]);
    },
    [onValueChange],
  );

  // Render trigger content
  const renderTriggerContent = () => {
    if (renderTrigger) {
      return renderTrigger(selectedOptions);
    }

    if (selectedOptions.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    if (mode === 'badge') {
      const visibleBadges = selectedOptions.slice(0, maxBadges);
      const remaining = selectedOptions.length - maxBadges;

      return (
        <div className="flex flex-wrap items-center gap-1">
          {visibleBadges.map((opt) => (
            <Badge key={opt.value} variant="secondary" className="text-lg">
              {opt.label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(opt.value);
                }}
                className="hover:bg-muted ml-1 rounded-full"
              >
                <X className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </Badge>
          ))}
          {remaining > 0 && (
            <Badge variant="secondary" className="text-lg">
              +{remaining} more
            </Badge>
          )}
        </div>
      );
    }

    // Count mode (default)
    return `${selectedOptions.length} item${selectedOptions.length > 1 ? 's' : ''} selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            // `text-lg` overrides the Button base `text-xl`, matching `Input` and
            // `AppSelect`. Set here rather than on `Button` so only this combobox
            // trigger changes — the placeholder is a <span>, so this class sizes it.
            'justify-between text-lg font-normal',
            !selectedOptions.length && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
        >
          <span className="flex-1 truncate text-left">{renderTriggerContent()}</span>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {selectedOptions.length > 0 && !disabled ? (
              <div
                role="button"
                aria-label="Clear selection"
                onClick={clearAll}
                onMouseDown={(e) => e.preventDefault()}
                className="hover:bg-accent cursor-pointer rounded-sm opacity-50 hover:opacity-80"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </div>
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-50" strokeWidth={1.5} />
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width: triggerWidth }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-full">
            <div
              className="overflow-y-auto overflow-x-hidden"
              style={{ maxHeight }}
              onWheel={(e) => e.stopPropagation()}
            >
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const isSelected = value.includes(option.value);
                  const isDisabled = option.disabled ?? false;

                  return (
                    <CommandItem
                      key={option.value}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={() => {
                        if (!isDisabled) {
                          toggleOption(option.value);
                        }
                      }}
                      disabled={isDisabled}
                    >
                      <Checkbox checked={isSelected} className="mr-2" disabled={isDisabled} />
                      {renderOption ? (
                        renderOption(option, isSelected)
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate font-medium">{option.label}</span>
                          {option.searchableText && (
                            <span className="text-muted-foreground truncate text-lg">
                              {option.searchableText}
                            </span>
                          )}
                        </div>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
