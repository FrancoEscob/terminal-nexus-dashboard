import useSWRMutation from 'swr/mutation';
import type { ApiResponse, SessionSummary, SessionType } from '@/types/session';

export interface CreateSessionInput {
  type: SessionType;
  name?: string;
  workdir: string;
  flags?: string[];
  command?: string;
}

async function createSession(url: string, { arg }: { arg: CreateSessionInput }): Promise<SessionSummary> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });

  const payload = (await response.json()) as ApiResponse<SessionSummary>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || `Failed to create session (${response.status})`);
  }

  return payload.data;
}

export function useCreateSession() {
  const mutation = useSWRMutation('/api/sessions', createSession);

  return {
    createSession: mutation.trigger,
    isCreating: mutation.isMutating,
    error: mutation.error as Error | undefined,
  };
}
