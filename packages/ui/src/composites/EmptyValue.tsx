import { EmptyValue as TemplateEmptyValue } from '../uab/primitives/display';

export interface EmptyValueProps {
  /** Accessible name; the visible text is always "N/A". */
  label?: string;
}

/** The one way to show a missing value: italic, very light grey "N/A", no icon. */
export function EmptyValue({ label }: EmptyValueProps) {
  return <TemplateEmptyValue label={label} />;
}
