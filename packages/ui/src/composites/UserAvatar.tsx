import { cn } from '../lib/cn';
import { Avatar, AvatarFallback, AvatarImage } from '../avatar';
import { getAvatarColor, getInitials } from '../lib/avatar';

export interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({ name, src, className, fallbackClassName }: UserAvatarProps) {
  const initials = getInitials(name ?? '');
  return (
    <Avatar className={className}>
      {src ? (
        <AvatarImage
          src={src}
          alt={name ?? ''}
          className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
        />
      ) : null}
      <AvatarFallback
        className={cn('font-medium text-background', getAvatarColor(initials), fallbackClassName)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
