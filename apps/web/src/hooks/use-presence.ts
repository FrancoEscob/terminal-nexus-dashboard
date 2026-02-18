import { useEffect, useMemo, useState } from 'react';
import { getClientUserId } from '@/lib/client-id';
import type { PresenceEntry } from '@/types/convex';

const PRESENCE_STORAGE_KEY = 'tn-presence';

function readPresence(): PresenceEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as PresenceEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresence(entries: PresenceEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(entries));
}

function usePresenceEntries() {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    setEntries(readPresence());
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PRESENCE_STORAGE_KEY) {
        setEntries(readPresence());
      }
    };

    const interval = window.setInterval(() => setEntries(readPresence()), 3000);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, []);

  return entries;
}

export function usePresenceTracker(sessionId?: string) {
  useEffect(() => {
    const userId = getClientUserId();

    const upsertPresence = () => {
      const current = readPresence().filter((entry) => entry.userId !== userId);
      const nextEntry: PresenceEntry = {
        userId,
        sessionId,
        status: document.hidden ? 'idle' : 'active',
        lastSeen: Date.now(),
      };

      writePresence([...current, nextEntry]);
    };

    upsertPresence();

    const interval = window.setInterval(upsertPresence, 5000);
    const onVisibility = () => upsertPresence();

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      const userIdToRemove = getClientUserId();
      const next = readPresence().filter((entry) => entry.userId !== userIdToRemove);
      writePresence(next);
    };
  }, [sessionId]);
}

export function usePresence(sessionId?: string) {
  const entries = usePresenceEntries();

  const viewers = useMemo(() => {
    if (!sessionId) return entries;
    return entries.filter((entry) => entry.sessionId === sessionId);
  }, [entries, sessionId]);

  return {
    viewers,
    entries,
    viewerCount: viewers.length,
  };
}
