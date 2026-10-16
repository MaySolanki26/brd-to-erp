import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface DelayedFallbackProps {
  children: ReactNode;
  delay?: number;
}

export function DelayedFallback({ children, delay = 200 }: DelayedFallbackProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;
  return <>{children}</>;
}
