'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { TerminalToolbar } from '@/components/TerminalToolbar';
import { XTerm } from '@/components/XTerm';
import { appendAuditLog } from '@/hooks/use-audit-logs';
import { usePresenceTracker } from '@/hooks/use-presence';
import { useSession } from '@/hooks/use-session';
import { useSessionActions } from '@/hooks/use-session-actions';

interface TerminalFullscreenViewProps {
  sessionId: string;
}

export function TerminalFullscreenView({ sessionId }: TerminalFullscreenViewProps) {
  const [clearSignal, setClearSignal] = useState(0);

  usePresenceTracker(sessionId);

  const { session, isLoading, error, mutate } = useSession(sessionId);
  const { killSession, restartSession, clearSession, isMutating } = useSessionActions(sessionId);

  const handleKill = async () => {
    if (!window.confirm('¿Seguro que quieres matar esta sesión?')) return;
    await killSession();
    appendAuditLog({ actor: 'fran', action: 'killed', sessionId, timestamp: Date.now() });
    await mutate();
  };

  const handleRestart = async () => {
    if (!window.confirm('¿Seguro que quieres reiniciar esta sesión?')) return;
    await restartSession();
    appendAuditLog({ actor: 'fran', action: 'restarted', sessionId, timestamp: Date.now() });
    await mutate();
  };

  const handleClear = async () => {
    await clearSession();
    setClearSignal((value) => value + 1);
    appendAuditLog({ actor: 'fran', action: 'typed', sessionId, metadata: { command: 'clear' }, timestamp: Date.now() });
  };

  if (isLoading) {
    return <main className="min-h-screen bg-slate-950 p-6 text-slate-300">Cargando terminal...</main>;
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p>No se pudo cargar la sesión.</p>
        <Link href="/" className="mt-4 inline-block text-cyan-300 underline">
          Volver al dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold">{session.name}</h1>
          <p className="text-xs text-slate-400">{session.workdir}</p>
        </div>
        <div className="flex items-center gap-3">
          <PresenceIndicator sessionId={session.id} />
          <Link href="/" className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="border-b border-slate-800 px-4 py-2">
        <TerminalToolbar
          sessionId={session.id}
          disabled={isMutating}
          onClear={handleClear}
          onRestart={handleRestart}
          onKill={handleKill}
        />
      </div>

      <section className="flex-1 p-2">
        <XTerm sessionId={session.id} syncResize clearSignal={clearSignal} className="h-[calc(100vh-128px)] w-full" />
      </section>
    </main>
  );
}
