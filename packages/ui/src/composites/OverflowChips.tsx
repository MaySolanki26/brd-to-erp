import { OverflowChips as TemplateOverflowChips } from '../uab/primitives/OverflowChips';

export interface OverflowChipsProps {
  items: string[];
  /** Field name for the list tooltip heading, e.g. "working days" gives "5 WORKING DAYS". */
  label: string;
  tone?: 'neutral' | 'accent';
  interactive?: boolean;
  /** Upper limit on shown chips; the rest fold into "+N". Without it, width decides. */
  maxVisible?: number;
}

export function OverflowChips({ items, label, tone, interactive }: OverflowChipsProps) {
  return (
    <TemplateOverflowChips
      items={items}
      label={label}
      tone={tone === 'accent' ? 'accent' : undefined}
      interactive={interactive}
    />
  );
}
