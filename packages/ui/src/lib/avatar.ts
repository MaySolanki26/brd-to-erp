/** Up-to-2-letter uppercase initials from a display name. */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-primary',
  'bg-success',
  'bg-violet',
  'bg-destructive',
  'bg-info',
  'bg-warning',
] as const;

/** Deterministic avatar background Tailwind class from initials. */
export function getAvatarColor(initials: string): string {
  const index = (initials.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0];
}
