import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { MemberCandidateDto } from '@brd/shared';
import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@brd/ui';

interface PersonPickerProps {
  people: MemberCandidateDto[];
  /** The selected person's user id, or an empty string. */
  value: string;
  onChange: (userId: string) => void;
  placeholder: string;
  disabled?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** Pick one person by typing part of their name or email address. */
export function PersonPicker({
  people,
  value,
  onChange,
  placeholder,
  disabled,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: PersonPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = people.find((person) => person.userId === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.name} (${selected.email})` : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search by name or email" />
          <CommandList>
            <CommandEmpty>No one matches</CommandEmpty>
            {people.map((person) => (
              <CommandItem
                key={person.userId}
                value={person.userId}
                keywords={[person.name, person.email]}
                onSelect={() => {
                  onChange(person.userId);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', person.userId === value ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">{person.name}</span>
                <span className="text-muted-foreground ml-2 truncate">{person.email}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
