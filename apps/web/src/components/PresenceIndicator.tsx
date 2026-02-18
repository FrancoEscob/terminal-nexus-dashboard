'use client';

import { usePresence } from '@/hooks/use-presence';

interface PresenceIndicatorProps {
  sessionId: string;
}

export function PresenceIndicator({ sessionId }: PresenceIndicatorProps) {
  const { viewers } = usePresence(sessionId);

  if (viewers.length === 0) {
    return <span className="text-xs text-slate-500">Nadie mirando</span>;
  }

  const names = viewers.slice(0, 3).map((viewer) => viewer.userId).join(', ');
  const extra = viewers.length > 3 ? ` +${viewers.length - 3}` : '';

  return <span className="text-xs text-slate-400">Viendo: {names}{extra}</span>;
}
