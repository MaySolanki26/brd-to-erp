import { InfoTip as TemplateInfoTip } from '../uab/primitives/InfoTip';

export interface InfoTipProps {
  /** The explanation. Explanatory text lives here, not as visible sentences. */
  text: string;
  label?: string;
  /** Kept for compatibility; the template tooltip always opens below or above as space allows. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  screenReaderCopy?: boolean;
  className?: string;
}

/** ⓘ icon that carries descriptions and help text; opens on hover, focus and tap via the global tooltip layer. */
export function InfoTip({ text, label }: InfoTipProps) {
  return <TemplateInfoTip text={text} label={label} />;
}
