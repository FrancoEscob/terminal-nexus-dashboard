const STORAGE_KEY = 'tn-user-id';

export function getClientUserId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const cached = window.localStorage.getItem(STORAGE_KEY);
  if (cached) return cached;

  const next = `fran-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(STORAGE_KEY, next);
  return next;
}
