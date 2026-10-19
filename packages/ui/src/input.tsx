import * as React from 'react';

import { cn } from './lib/cn';

export interface InputProps extends React.ComponentProps<'input'> {
  /** Kept for compatibility: number inputs never show spinner arrows (template rule). */
  spinner?: boolean;
  /** 32px control for toolbars and filters; forms use the default 40px. */
  compact?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, spinner: _spinner, compact = false, ...props }, ref) => (
    <input
      type={type}
      className={cn('uab-input', compact && 'uab-input-compact', className)}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
