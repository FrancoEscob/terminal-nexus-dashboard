import useSWRMutation from 'swr/mutation';
import { sendTerminalInput } from '@/lib/socket-client';
import type { ApiResponse, SessionSummary } from '@/types/session';

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  if (payload.data === undefined) {
    throw new Error('Missing response data');
  }
  return payload.data;
}

async function killSession(url: string): Promise<void> {
  const response = await fetch(url, { method: 'DELETE' });
  const payload = (await response.json()) as ApiResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Failed to kill session (${response.status})`);
  }
}

async function restartSession(url: string): Promise<SessionSummary> {
  const response = await fetch(`${url}/restart`, { method: 'POST' });
  return parseResponse<SessionSummary>(response);
}

export function useSessionActions(sessionId: string | null) {
  const baseUrl = sessionId ? `/api/sessions/${sessionId}` : '';

  const kill = useSWRMutation(baseUrl, killSession);
  const restart = useSWRMutation(baseUrl, restartSession);

  const clear = async () => {
    if (!sessionId) return;
    await sendTerminalInput(sessionId, '\u000c');
  };

  return {
    killSession: kill.trigger,
    restartSession: restart.trigger,
    clearSession: clear,
    isMutating: kill.isMutating || restart.isMutating,
    error: (kill.error || restart.error) as Error | undefined,
  };
}
