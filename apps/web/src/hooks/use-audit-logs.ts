import { useEffect, useState } from 'react';
import type { AuditLogEntry } from '@/types/convex';

const AUDIT_STORAGE_KEY = 'tn-audit-logs';

function readLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as AuditLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendAuditLog(entry: AuditLogEntry) {
  if (typeof window === 'undefined') return;
  const current = readLogs();
  const next = [entry, ...current].slice(0, 500);
  window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
}

export function useAuditLogs(sessionId?: string) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const refresh = () => {
      const all = readLogs();
      setLogs(sessionId ? all.filter((log) => log.sessionId === sessionId) : all);
    };

    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUDIT_STORAGE_KEY) {
        refresh();
      }
    };

    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(refresh, 3000);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [sessionId]);

  return { logs };
}
