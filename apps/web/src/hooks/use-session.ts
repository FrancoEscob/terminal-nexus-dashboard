import useSWR from 'swr';
import type { ApiResponse, SessionSummary } from '@/types/session';

const fetcher = async (url: string): Promise<SessionSummary> => {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiResponse<SessionSummary>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || `Failed to fetch session (${response.status})`);
  }

  return payload.data;
};

export function useSession(sessionId?: string) {
  const swr = useSWR(sessionId ? `/api/sessions/${sessionId}` : null, fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 10000,
  });

  return {
    session: swr.data,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    mutate: swr.mutate,
  };
}
