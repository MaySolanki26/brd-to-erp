import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from './lib/cn';

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: 'xs' | 'default' | 'sm';
}

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchProps>(
  ({ className, size = 'default', ...props }, ref) => {
    const isXs = size === 'xs';
    const isSm = size === 'sm';
    return (
      <SwitchPrimitives.Root
        className={cn(
          'focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          isXs ? 'h-3.5 w-7' : isSm ? 'h-4 w-8' : 'h-6 w-11',
          className,
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            'bg-background pointer-events-none block rounded-full shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0',
            isXs
              ? 'h-2.5 w-2.5 data-[state=checked]:translate-x-3.5'
              : isSm
                ? 'h-3 w-3 data-[state=checked]:translate-x-4'
                : 'h-5 w-5 data-[state=checked]:translate-x-5',
          )}
        />
      </SwitchPrimitives.Root>
    );
  },
);
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
