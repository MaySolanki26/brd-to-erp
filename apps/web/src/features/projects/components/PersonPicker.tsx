import { useMemo } from 'react';
import type { MemberCandidateDto } from '@brd/shared';
import { SelectMenu } from '@brd/ui';

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

/** Pick one person; the list gets a search box so a name or an email address narrows it. */
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
  const options = useMemo(
    () =>
      people.map((person) => ({ value: person.userId, label: `${person.name} (${person.email})` })),
    [people],
  );

  return (
    <SelectMenu
      id={id}
      block
      searchable
      label="Person"
      placeholder={placeholder}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      invalid={ariaInvalid}
      describedBy={ariaDescribedBy}
    />
  );
}
