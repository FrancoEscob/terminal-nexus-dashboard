'use client';

import Link from 'next/link';

interface TerminalToolbarProps {
  sessionId: string;
  disabled?: boolean;
  onKill: () => Promise<void>;
  onRestart: () => Promise<void>;
  onClear: () => Promise<void>;
}

export function TerminalToolbar({ sessionId, disabled = false, onKill, onRestart, onClear }: TerminalToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onClear()}
        className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 disabled:opacity-50"
      >
        Clear
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => void onRestart()}
        className="rounded-md border border-amber-500/60 px-3 py-1 text-xs text-amber-200 hover:border-amber-400 disabled:opacity-50"
      >
        Restart
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => void onKill()}
        className="rounded-md border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400 disabled:opacity-50"
      >
        Kill
      </button>

      <Link
        href={`/terminal/${sessionId}`}
        className="ml-auto rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400"
      >
        Fullscreen
      </Link>
    </div>
  );
}
