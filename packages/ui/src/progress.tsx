import * as React from 'react';

import { cn } from './lib/cn';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 to 100. */
  value?: number | null;
  /** Kept for compatibility; the template meter has one fill colour. */
  indicatorClassName?: string;
}

/** The template meter: a thin track with a fill. */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indicatorClassName: _indicator, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value ?? 0));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn('uab-meter-track', className)}
        {...props}
      >
        {/* The fill width is the progress itself: a dynamic value. */}
        <span className="uab-meter-fill" style={{ width: `${clamped}%` }} />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
