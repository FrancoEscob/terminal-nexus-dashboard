import useSWR from 'swr';
import type { ApiResponse, SessionSummary } from '@/types/session';

const fetcher = async (url: string): Promise<SessionSummary[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions (${response.status})`);
  }

  const payload = (await response.json()) as ApiResponse<SessionSummary[]>;
  if (!payload.success || !payload.data) {
    throw new Error(payload.error || 'Failed to fetch sessions');
  }

  return payload.data;
};

export function useSessions() {
  const swr = useSWR<SessionSummary[]>('/api/sessions', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 10000,
  });

  const sessions = (swr.data || []).slice().sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    sessions,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    error: swr.error as Error | undefined,
    mutate: swr.mutate,
  };
}
