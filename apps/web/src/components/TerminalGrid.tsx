'use client';

import { useMemo, useState } from 'react';
import { NewSessionModal } from '@/components/NewSessionModal';
import { TerminalModal } from '@/components/TerminalModal';
import { TerminalTile } from '@/components/TerminalTile';
import { useLayout } from '@/hooks/use-layout';
import type { SessionSummary } from '@/types/session';

interface TerminalGridProps {
  sessions: SessionSummary[];
  isLoading: boolean;
  error?: Error;
  onRefresh?: () => void;
}

export function TerminalGrid({ sessions, isLoading, error, onRefresh }: TerminalGridProps) {
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [expandedSession, setExpandedSession] = useState<SessionSummary | null>(null);

  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const { orderedSessionIds, moveSession } = useLayout(sessionIds);

  const orderedSessions = useMemo(() => {
    const byId = new Map(sessions.map((session) => [session.id, session]));
    return orderedSessionIds.map((id) => byId.get(id)).filter(Boolean) as SessionSummary[];
  }, [orderedSessionIds, sessions]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        No se pudo cargar la galeria de sesiones: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/60" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setIsNewSessionOpen(true)}
          className="rounded-lg border border-cyan-500/70 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
        >
          + New Session
        </button>
      </div>

      {orderedSessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-8 text-center">
          <p className="text-sm text-slate-300">No hay sesiones activas.</p>
          <p className="mt-2 text-xs text-slate-500">Crea una con el boton + New Session para verla aqui en tiempo real.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {orderedSessions.map((session) => (
            <TerminalTile
              key={session.id}
              session={session}
              onOpen={setExpandedSession}
              onDragStart={setDraggingSessionId}
              onDropOn={(targetId) => {
                if (!draggingSessionId || draggingSessionId === targetId) return;
                moveSession(draggingSessionId, targetId);
                setDraggingSessionId(null);
              }}
            />
          ))}
        </div>
      )}

      {expandedSession && (
        <TerminalModal
          session={expandedSession}
          onClose={() => setExpandedSession(null)}
          onChanged={() => {
            onRefresh?.();
          }}
        />
      )}

      <NewSessionModal
        isOpen={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onCreated={() => {
          onRefresh?.();
        }}
      />
    </>
  );
}
