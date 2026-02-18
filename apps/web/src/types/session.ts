export type SessionType = 'claude' | 'droid' | 'shell';
export type SessionStatus = 'running' | 'stopped' | 'error';

export interface SessionSummary {
  id: string;
  name: string;
  type: SessionType;
  workdir: string;
  command: string;
  flags: string[];
  status: SessionStatus;
  pid?: number;
  createdAt: string;
  updatedAt: string;
  exitCode?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
