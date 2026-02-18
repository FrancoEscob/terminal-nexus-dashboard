'use client';

import { useMemo, useState } from 'react';
import { appendAuditLog } from '@/hooks/use-audit-logs';
import { useCreateSession } from '@/hooks/use-create-session';
import { useSessionTemplates } from '@/hooks/use-session-templates';
import type { SessionType } from '@/types/session';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const typeOptions: SessionType[] = ['claude', 'droid', 'shell'];

function getDefaultWorkdir(): string {
  return navigator.platform.toLowerCase().includes('win')
    ? 'C:\\Users\\frand\\Projects'
    : '/home/fran/projects';
}

function isLikelyAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:\\/.test(value) || value.startsWith('/');
}

export function NewSessionModal({ isOpen, onClose, onCreated }: NewSessionModalProps) {
  const { createSession, isCreating, error } = useCreateSession();
  const { templates, saveTemplate } = useSessionTemplates();

  const [type, setType] = useState<SessionType>('shell');
  const [name, setName] = useState('');
  const [workdir, setWorkdir] = useState(getDefaultWorkdir);
  const [command, setCommand] = useState('');
  const [yolo, setYolo] = useState(false);
  const [fullAuto, setFullAuto] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const generatedName = useMemo(() => `${type}-${Date.now().toString(36).slice(-4)}`, [type]);

  if (!isOpen) return null;

  const hasWorkdir = workdir.trim().length > 0;
  const hasAbsoluteWorkdir = isLikelyAbsolutePath(workdir.trim());
  const canSubmit = hasWorkdir && hasAbsoluteWorkdir;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const flags = [yolo ? '--yolo' : null, fullAuto ? '--full-auto' : null].filter(Boolean) as string[];

    const createdSession = await createSession({
      type,
      name: name.trim() || generatedName,
      workdir: workdir.trim(),
      command: type === 'shell' ? command.trim() || undefined : undefined,
      flags,
    });

    appendAuditLog({
      actor: 'fran',
      action: 'created',
      sessionId: createdSession.id,
      metadata: { workdir: createdSession.workdir, command: createdSession.command },
      timestamp: Date.now(),
    });

    if (saveAsTemplate) {
      saveTemplate({
        name: name.trim() || generatedName,
        type,
        workdir: workdir.trim(),
        command: type === 'shell' ? command.trim() || undefined : undefined,
        flags,
      });
    }

    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">New Session</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200">Cerrar</button>
        </div>

        <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Type</label>
        <div className="mb-4 flex gap-2">
          {typeOptions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`rounded-md border px-3 py-1 text-xs uppercase ${type === value ? 'border-cyan-400 text-cyan-300' : 'border-slate-600 text-slate-300'}`}
            >
              {value}
            </button>
          ))}
        </div>

        <label htmlFor="new-session-name" className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Name</label>
        <input
          id="new-session-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={generatedName}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />

        <label htmlFor="new-session-workdir" className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Working Directory</label>
        <input
          id="new-session-workdir"
          value={workdir}
          onChange={(event) => setWorkdir(event.target.value)}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          required
        />
        {!hasAbsoluteWorkdir && hasWorkdir && (
          <p className="mb-4 text-xs text-amber-300">Usa una ruta absoluta (ej: C:\\Users\\frand\\Projects o /tmp).</p>
        )}

        {type === 'shell' && (
          <>
            <label htmlFor="new-session-command" className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Command (opcional)</label>
            <input
              id="new-session-command"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="python script.py"
              className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </>
        )}

        {type === 'claude' && (
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={yolo} onChange={(event) => setYolo(event.target.checked)} /> --yolo
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={fullAuto} onChange={(event) => setFullAuto(event.target.checked)} /> --full-auto
            </label>
          </div>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)} />
          Guardar como template
        </label>

        {templates.length > 0 && (
          <p className="mb-4 text-xs text-slate-500">Templates guardados: {templates.length}</p>
        )}

        {error && <p className="mb-4 text-sm text-rose-300">{error.message}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-200">Cancelar</button>
          <button type="submit" disabled={isCreating || !canSubmit} className="rounded-md border border-cyan-500 px-3 py-1 text-sm text-cyan-200 disabled:opacity-50">
            {isCreating ? 'Creando...' : 'Crear sesión'}
          </button>
        </div>
      </form>
    </div>
  );
}
