'use client';

import Link from 'next/link';
import { useAuditLogs } from '@/hooks/use-audit-logs';

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

export default function LogsPage() {
  const { logs } = useAuditLogs();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#090d1a] via-[#0d1326] to-[#05070f] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Terminal Nexus</p>
            <h1 className="mt-2 text-3xl font-semibold">Audit Logs</h1>
            <p className="mt-1 text-sm text-slate-400">Registro de acciones de sesiones (create/kill/restart/clear).</p>
          </div>
          <Link href="/" className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:border-cyan-400">
            Volver al dashboard
          </Link>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70">
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No hay eventos registrados aún.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {logs.map((log, index) => (
                <li key={`${log.sessionId}-${log.timestamp}-${index}`} className="p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs uppercase text-cyan-200">{log.action}</span>
                    <span className="text-slate-200">session: {log.sessionId}</span>
                    <span className="text-slate-500">actor: {log.actor}</span>
                    <span className="text-slate-500">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  {log.metadata && (
                    <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-xs text-slate-400">{JSON.stringify(log.metadata, null, 2)}</pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
