import { useCallback, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

interface TruncatedTextProps {
  text: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function TruncatedText({ text, className, side = 'top' }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setIsOverflowing(el.scrollWidth > el.clientWidth);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            ref={ref}
            onMouseEnter={measure}
            onFocus={measure}
            className={cn('block truncate', className)}
          >
            {text}
          </span>
        </TooltipTrigger>
        {isOverflowing && (
          <TooltipContent side={side} className="max-w-xs break-words">
            {text}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
