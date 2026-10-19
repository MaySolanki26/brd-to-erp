import { cn } from '../lib/cn';

interface TruncatedTextProps {
  text: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/** One line cut with an ellipsis; the global tooltip layer shows the full text on hover and focus. */
export function TruncatedText({ text, className }: TruncatedTextProps) {
  return <span className={cn('block truncate', className)}>{text}</span>;
}
