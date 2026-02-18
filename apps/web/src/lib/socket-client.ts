import { io, type Socket } from 'socket.io-client';
import type { SessionStatus } from '@/types/session';

interface ServerToClientEvents {
  'terminal:output': (sessionId: string, data: string) => void;
  'terminal:status': (sessionId: string, status: SessionStatus) => void;
  'terminal:exited': (sessionId: string, exitCode: number) => void;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void;
}

interface ClientToServerEvents {
  'terminal:join': (sessionId: string) => void;
  'terminal:leave': (sessionId: string) => void;
  'terminal:input': (sessionId: string, data: string) => void;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void;
}

type TerminalSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TerminalSocket | null = null;
let initialized = false;
let reconnectHookAttached = false;
const joinedSessionCounts = new Map<string, number>();
const outputListeners = new Set<(sessionId: string, data: string) => void>();
const statusListeners = new Set<(sessionId: string, status: SessionStatus) => void>();
const resizeListeners = new Set<(sessionId: string, cols: number, rows: number) => void>();

async function ensureSocketRouteInitialized(): Promise<void> {
  if (initialized || typeof window === 'undefined') {
    return;
  }

  await fetch('/api/socket-io');
  initialized = true;
}

export async function getSocketClient(): Promise<TerminalSocket> {
  if (typeof window === 'undefined') {
    throw new Error('Socket client can only run in the browser');
  }

  await ensureSocketRouteInitialized();

  if (!socket) {
    socket = io({
      path: '/api/socket-io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });
  }

  if (!reconnectHookAttached) {
    socket.on('connect', () => {
      joinedSessionCounts.forEach((count, sessionId) => {
        if (count <= 0) return;
        socket?.emit('terminal:join', sessionId);
      });
    });

    socket.on('terminal:output', (sessionId, data) => {
      outputListeners.forEach((listener) => listener(sessionId, data));
    });

    socket.on('terminal:status', (sessionId, status) => {
      statusListeners.forEach((listener) => listener(sessionId, status));
    });

    socket.on('terminal:resize', (sessionId, cols, rows) => {
      resizeListeners.forEach((listener) => listener(sessionId, cols, rows));
    });

    reconnectHookAttached = true;
  }

  return socket;
}

export async function joinSession(sessionId: string): Promise<void> {
  const client = await getSocketClient();
  const currentCount = joinedSessionCounts.get(sessionId) ?? 0;
  const nextCount = currentCount + 1;
  joinedSessionCounts.set(sessionId, nextCount);

  if (currentCount === 0) {
    client.emit('terminal:join', sessionId);
  }
}

export async function leaveSession(sessionId: string): Promise<void> {
  const client = await getSocketClient();
  const currentCount = joinedSessionCounts.get(sessionId) ?? 0;
  if (currentCount <= 1) {
    joinedSessionCounts.delete(sessionId);
    client.emit('terminal:leave', sessionId);
    return;
  }

  joinedSessionCounts.set(sessionId, currentCount - 1);
}

export async function sendTerminalInput(sessionId: string, data: string): Promise<void> {
  const client = await getSocketClient();
  client.emit('terminal:input', sessionId, data);
}

export async function sendTerminalResize(sessionId: string, cols: number, rows: number): Promise<void> {
  const client = await getSocketClient();
  client.emit('terminal:resize', sessionId, cols, rows);
}

export function getJoinedSessionsSnapshot(): string[] {
  return Array.from(joinedSessionCounts.keys());
}

export function addTerminalOutputListener(
  listener: (sessionId: string, data: string) => void,
): () => void {
  outputListeners.add(listener);
  return () => {
    outputListeners.delete(listener);
  };
}

export function addTerminalStatusListener(
  listener: (sessionId: string, status: SessionStatus) => void,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function addTerminalResizeListener(
  listener: (sessionId: string, cols: number, rows: number) => void,
): () => void {
  resizeListeners.add(listener);
  return () => {
    resizeListeners.delete(listener);
  };
}
