import { IPty } from 'node-pty';
import fs from 'fs';
import path from 'path';

export interface SessionConfig {
  name?: string;
  type: 'claude' | 'droid' | 'shell';
  workdir: string;
  command?: string;
  flags?: string[];
  cols?: number;
  rows?: number;
}

export interface Session {
  id: string;
  name: string;
  type: 'claude' | 'droid' | 'shell';
  workdir: string;
  command: string;
  flags: string[];
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  socketPath: string;
  pty?: IPty;
  tmuxSession?: string;
  createdAt: Date;
  updatedAt: Date;
  exitCode?: number;
}

export interface SessionCreateRequest {
  type: 'claude' | 'droid' | 'shell';
  workdir: string;
  name?: string;
  command?: string;
  flags?: string[];
  cols?: number;
  rows?: number;
}

export interface SessionUpdateRequest {
  name?: string;
  cols?: number;
  rows?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Socket.io Events
export interface ServerToClientEvents {
  'terminal:output': (sessionId: string, data: string) => void;
  'terminal:status': (sessionId: string, status: 'running' | 'stopped' | 'error') => void;
  'terminal:exited': (sessionId: string, exitCode: number) => void;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void;
  'session:created': (session: Session) => void;
  'session:updated': (session: Session) => void;
  'session:killed': (sessionId: string) => void;
}

export interface ClientToServerEvents {
  'terminal:join': (sessionId: string) => void;
  'terminal:leave': (sessionId: string) => void;
  'terminal:input': (sessionId: string, data: string) => void;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void;
}

export interface SocketUser {
  id: string;
  joinedSessions: Set<string>;
}

// Command builders for different session types
export class CommandBuilder {
  static buildClaudeCommand(workdir: string, flags: string[] = []): string {
    void workdir;
    const parts = ['claude'];
    
    if (flags.includes('--yolo')) parts.push('--yolo');
    if (flags.includes('--full-auto')) parts.push('--full-auto');
    
    return parts.join(' ');
  }

  static buildDroidCommand(workdir: string, flags: string[] = []): string {
    void workdir;
    void flags;
    const parts = ['droid'];
    
    return parts.join(' ');
  }

  static buildShellCommand(command?: string): string {
    if (!command) {
      return process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    }
    return command;
  }
}

// Security
export const ALLOWED_BASE_DIRS = [
  '/root/projects',
  '/home/fran/projects',
  '/tmp/experiments',
  '/Users/frand/projects', // macOS
  'C:\\Users\\fran\\projects', // Windows for testing
  'C:\\Users\\frand\\Projects', // Windows current workspace
];

export function validateWorkdir(input: string): string {
  const trimmed = input.trim();

  if (process.platform !== 'win32' && /^[A-Za-z]:\\/.test(trimmed)) {
    throw new Error(`Invalid workdir: ${input} (Windows path used on non-Windows runtime)`);
  }

  if (!path.isAbsolute(trimmed)) {
    throw new Error(`Invalid workdir: ${input} (must be an absolute path)`);
  }

  const resolved = path.resolve(input);
  const isAllowed = ALLOWED_BASE_DIRS.some(base => 
    resolved.startsWith(base)
  );
  
  if (!isAllowed) {
    throw new Error(`Invalid workdir: ${input} (outside allowed paths)`);
  }

  if (!fs.existsSync(resolved)) {
    throw new Error(`Invalid workdir: ${input} (directory does not exist)`);
  }

  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`Invalid workdir: ${input} (not a directory)`);
  }
  
  return resolved;
}
