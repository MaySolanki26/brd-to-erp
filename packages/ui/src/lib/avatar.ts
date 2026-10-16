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
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-amber-500',
] as const;

/** Deterministic avatar background Tailwind class from initials. */
export function getAvatarColor(initials: string): string {
  const index = (initials.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0];
}
