import { useCallback, useEffect, useMemo, useState } from 'react';

const LAYOUT_STORAGE_KEY = 'tn-layout-order';

function loadOrder(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistOrder(order: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(order));
}

export function useLayout(sessionIds: string[]) {
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    setOrder(loadOrder());
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAYOUT_STORAGE_KEY) {
        setOrder(loadOrder());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const orderedSessionIds = useMemo(() => {
    const known = new Set(sessionIds);
    const validOrder = order.filter((id) => known.has(id));
    const missing = sessionIds.filter((id) => !validOrder.includes(id));
    return [...validOrder, ...missing];
  }, [order, sessionIds]);

  const moveSession = useCallback((draggedId: string, targetId: string) => {
    setOrder((current) => {
      const base = current.length > 0 ? [...current] : [...sessionIds];
      const filtered = base.filter((id) => id !== draggedId);
      const targetIndex = filtered.indexOf(targetId);
      if (targetIndex < 0) {
        const appended = [...filtered, draggedId];
        persistOrder(appended);
        return appended;
      }

      filtered.splice(targetIndex, 0, draggedId);
      persistOrder(filtered);
      return filtered;
    });
  }, [sessionIds]);

  const setDefaultLayout = useCallback((ids: string[]) => {
    setOrder(ids);
    persistOrder(ids);
  }, []);

  return {
    orderedSessionIds,
    moveSession,
    setDefaultLayout,
  };
}
