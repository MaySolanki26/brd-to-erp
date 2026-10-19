import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/** A template page: padded, scrolling content under the top bar. */
export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn('uab-page', className)}>{children}</div>;
}

interface PageShellBodyProps {
  children: ReactNode;
  className?: string;
  /** Kept for compatibility; the template page body is always padded. */
  padded?: boolean;
  scroll?: boolean;
}

export function PageShellBody({ children, className }: PageShellBodyProps) {
  return <div className={cn('uab-page-main', className)}>{children}</div>;
}

PageShell.Body = PageShellBody;
