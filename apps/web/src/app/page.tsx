'use client';

import Link from 'next/link';
import { TerminalGrid } from '@/components/TerminalGrid';
import { useSessions } from '@/hooks/use-sessions';

export default function Home() {
  const { sessions, isLoading, error, mutate } = useSessions();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#090d1a] via-[#0d1326] to-[#05070f] text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Terminal Nexus</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard de Sesiones</h1>
            <p className="mt-2 text-sm text-slate-400">Vista de galeria en tiempo real conectada a tmux + Socket.io.</p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sesiones activas</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-300">{sessions.length}</p>
            <Link href="/logs" className="mt-2 block text-xs text-cyan-200 hover:text-cyan-100">
              Ver audit logs
            </Link>
          </div>
        </header>

        <TerminalGrid sessions={sessions} isLoading={isLoading} error={error} onRefresh={() => void mutate()} />
      </div>
    </main>
  );
}
