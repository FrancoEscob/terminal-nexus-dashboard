import type { SessionStatus, SessionType } from '@/types/session';

type RuntimeKind = 'direct' | 'tmux' | 'vibe' | 'unknown';
type LogLevel = 'info' | 'warn' | 'error';

interface RuntimeLifecycleLog {
  event: string;
  sessionId?: string;
  sessionType?: SessionType;
  runtime?: RuntimeKind;
  status?: SessionStatus | 'creating' | 'starting' | 'reconnecting' | 'failed' | 'exited';
  exitCode?: number;
  source?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  level?: LogLevel;
}

export function logRuntimeLifecycle(entry: RuntimeLifecycleLog): void {
  const payload = {
    timestamp: new Date().toISOString(),
    runtime: entry.runtime ?? 'unknown',
    level: entry.level ?? 'info',
    ...entry,
  };

  const message = `[runtime.lifecycle] ${JSON.stringify(payload)}`;

  if (payload.level === 'error') {
    console.error(message);
    return;
  }

  if (payload.level === 'warn') {
    console.warn(message);
    return;
  }

  console.info(message);
}
