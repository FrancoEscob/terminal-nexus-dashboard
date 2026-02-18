'use client';

import { useEffect, useState } from 'react';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { XTerm } from '@/components/XTerm';
import { addTerminalStatusListener } from '@/lib/socket-client';
import { useUiStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils';
import type { SessionSummary } from '@/types/session';

interface TerminalTileProps {
  session: SessionSummary;
  onOpen: (session: SessionSummary) => void;
  onDragStart?: (sessionId: string) => void;
  onDropOn?: (sessionId: string) => void;
}

function statusClasses(status: SessionSummary['status']) {
  switch (status) {
    case 'running':
      return 'bg-emerald-400';
    case 'stopped':
      return 'bg-amber-400';
    case 'error':
      return 'bg-rose-500';
    default:
      return 'bg-slate-500';
  }
}

function formatUptime(createdAt: string): string {
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function TerminalTile({ session, onOpen, onDragStart, onDropOn }: TerminalTileProps) {
  const selectedSessionId = useUiStore((state) => state.selectedSessionId);
  const selectSession = useUiStore((state) => state.selectSession);
  const [status, setStatus] = useState(session.status);

  useEffect(() => {
    setStatus(session.status);
  }, [session.status]);

  useEffect(() => {
    const unsubscribe = addTerminalStatusListener((incomingSessionId, incomingStatus) => {
      if (incomingSessionId === session.id) {
        setStatus(incomingStatus);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [session.id]);

  return (
    <article
      role="button"
      tabIndex={0}
      draggable
      onDragStart={() => onDragStart?.(session.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropOn?.(session.id)}
      onClick={() => {
        selectSession(session.id);
        onOpen(session);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectSession(session.id);
          onOpen(session);
        }
      }}
      className={cn(
        'rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-xl transition hover:border-slate-500/80 hover:bg-slate-900',
        selectedSessionId === session.id && 'border-cyan-400/70 ring-1 ring-cyan-400/70',
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-100">{session.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-400">{session.workdir}</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-300">
          {session.type}
        </span>
      </header>

      <div className="mb-3 h-40 overflow-hidden rounded-lg border border-slate-800 bg-[#0b1020]">
        <XTerm sessionId={session.id} readOnly className="px-1 py-1" />
      </div>

      <footer className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', statusClasses(status))} aria-hidden />
          <span className="capitalize">{status}</span>
        </div>
        <span>{formatUptime(session.createdAt)}</span>
      </footer>

      <div className="mt-2">
        <PresenceIndicator sessionId={session.id} />
      </div>
    </article>
  );
}
