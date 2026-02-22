'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XTerm } from '@/components/XTerm';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { TerminalToolbar } from '@/components/TerminalToolbar';
import { usePresenceTracker } from '@/hooks/use-presence';
import { useSessionActions } from '@/hooks/use-session-actions';
import { appendAuditLog } from '@/hooks/use-audit-logs';
import type { SessionSummary } from '@/types/session';

interface TerminalModalProps {
  session: SessionSummary;
  onClose: () => void;
  onChanged: () => void;
}

export function TerminalModal({ session, onClose, onChanged }: TerminalModalProps) {
  usePresenceTracker(session.id);
  const [clearSignal, setClearSignal] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { killSession, restartSession, clearSession, isMutating, error } = useSessionActions(session.id);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleKill = async () => {
    if (!window.confirm('¿Seguro que quieres matar esta sesión?')) return;
    await killSession();
    appendAuditLog({ actor: 'fran', action: 'killed', sessionId: session.id, timestamp: Date.now() });
    onChanged();
    onClose();
  };

  const handleRestart = async () => {
    if (!window.confirm('¿Seguro que quieres reiniciar esta sesión?')) return;
    await restartSession();
    appendAuditLog({ actor: 'fran', action: 'restarted', sessionId: session.id, timestamp: Date.now() });
    onChanged();
  };

  const handleClear = async () => {
    await clearSession();
    setClearSignal((value) => value + 1);
    appendAuditLog({ actor: 'fran', action: 'typed', sessionId: session.id, metadata: { command: 'clear' }, timestamp: Date.now() });
  };

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{session.name}</h3>
            <p className="text-xs text-slate-400">{session.workdir}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200">Cerrar</button>
        </div>

        <div className="border-b border-slate-700 px-4 py-2">
          <TerminalToolbar
            sessionId={session.id}
            disabled={isMutating}
            onClear={handleClear}
            onRestart={handleRestart}
            onKill={handleKill}
          />
          <div className="mt-2">
            <PresenceIndicator sessionId={session.id} />
          </div>
          {error && <p className="mt-2 text-sm text-rose-300">{error.message}</p>}
        </div>

        <div className="flex-1 bg-[#0b1020] p-2">
          <XTerm sessionId={session.id} syncResize clearSignal={clearSignal} className="h-full w-full" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
