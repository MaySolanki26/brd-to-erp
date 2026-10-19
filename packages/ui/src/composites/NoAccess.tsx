import { Lock } from 'lucide-react';

interface NoAccessProps {
  title?: string;
  description?: string;
  /** Kept for compatibility; the template state looks the same inline and full. */
  variant?: 'inline' | 'full';
  className?: string;
}

/** The template no-access state. */
export function NoAccess({
  title = 'Access restricted',
  description = "You don't have permission to view this page.",
}: NoAccessProps) {
  return (
    <div className="uab-state">
      <span className="uab-state-icon">
        <Lock size={20} strokeWidth={1.75} aria-hidden="true" focusable={false} />
      </span>
      <p className="uab-state-title">{title}</p>
      <p className="uab-state-text">{description}</p>
    </div>
  );
}
