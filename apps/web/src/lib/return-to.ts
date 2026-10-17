const LOGIN_PATH = '/login';
const BACKSLASH = 0x5c;
const LAST_CONTROL_CHAR = 0x1f;

// Backslashes and control characters let some browsers read "/\evil.com" as a different origin.
function hasUnsafeChars(value: string): boolean {
  return [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code === BACKSLASH || code <= LAST_CONTROL_CHAR;
  });
}

/** Only same-origin relative paths are accepted, so a crafted link cannot bounce users off-site. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafeChars(value)) {
    return '/';
  }
  const isLoginPath =
    value === LOGIN_PATH ||
    value.startsWith(`${LOGIN_PATH}?`) ||
    value.startsWith(`${LOGIN_PATH}/`);
  return isLoginPath ? '/' : value;
}

export function loginUrl(returnTo: string): string {
  const safe = safeReturnTo(returnTo);
  return safe === '/' ? LOGIN_PATH : `${LOGIN_PATH}?returnTo=${encodeURIComponent(safe)}`;
}
