import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../lib/cn';
import { toast } from '../toast';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export interface CopyButtonProps {
  value: string | null | undefined;
  label?: string;
  className?: string;
  iconSize?: string;
  confirmMs?: number;
  toastOnCopy?: boolean;
}

export function CopyButton({
  value,
  label = 'value',
  className,
  iconSize = 'h-3 w-3',
  confirmMs = 1500,
  toastOnCopy = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), confirmMs);
    return () => window.clearTimeout(t);
  }, [copied, confirmMs]);

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!value) return;
      const ok = await copyToClipboard(value);
      if (ok) {
        setCopied(true);
        if (toastOnCopy) toast.success(`Copied ${label}`);
      } else {
        toast.error(`Could not copy the ${label}`);
      }
    },
    [label, toastOnCopy, value],
  );

  if (!value) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      title={copied ? 'Copied!' : `Copy ${label}`}
      className={cn(
        'text-muted-foreground/70 hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1',
        className,
      )}
    >
      {copied ? (
        <Check className={cn(iconSize, 'text-success-fg')} strokeWidth={2} aria-hidden />
      ) : (
        <Copy className={iconSize} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
