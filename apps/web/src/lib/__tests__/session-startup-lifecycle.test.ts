// @vitest-environment node

import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
}));

vi.mock('@/lib/db/schema', () => ({
  sessions: { id: 'id' },
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('@/lib/tmux', () => ({
  TmuxWrapper: {
    generateSocketPath: vi.fn((sessionId: string) => `/tmp/${sessionId}.sock`),
    createSession: vi.fn(async ({ name }: { name: string }) => name),
    killSession: vi.fn(async () => undefined),
    resizeSession: vi.fn(async () => undefined),
    listSessions: vi.fn(async () => []),
    getTmuxBinary: vi.fn(() => 'tmux'),
  },
}));

import { spawn as spawnPty } from 'node-pty';
import { spawn as spawnProcess } from 'child_process';
import { db } from '@/lib/db';
import { TmuxWrapper } from '@/lib/tmux';
import { SessionManager } from '@/lib/session-manager';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPty {
  pid: number;
  onData: (handler: (data: string) => void) => void;
  onExit: (handler: (event: { exitCode: number }) => void) => void;
  write: MockFn;
  resize: MockFn;
  kill: MockFn;
  emitExit: (exitCode: number) => void;
}

const createdPtys: MockPty[] = [];

let insertValuesMock: MockFn;
let updateSetMock: MockFn;

function createMockPty(pid: number): MockPty {
  const exitHandlers: Array<(event: { exitCode: number }) => void> = [];

  return {
    pid,
    onData: vi.fn(),
    onExit: vi.fn((handler: (event: { exitCode: number }) => void) => {
      exitHandlers.push(handler);
    }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    emitExit: (exitCode: number) => {
      exitHandlers.forEach((handler) => handler({ exitCode }));
    },
  };
}

function resetSessionManagerState(): SessionManager {
  const manager = SessionManager.getInstance();
  const internalManager = manager as unknown as {
    activeSessions: Map<string, unknown>;
    sessionOutputs: Map<string, string[]>;
    activePtyPids: Map<string, number>;
  };

  internalManager.activeSessions.clear();
  internalManager.sessionOutputs.clear();
  internalManager.activePtyPids.clear();

  return manager;
}

beforeEach(() => {
  vi.clearAllMocks();
  createdPtys.length = 0;

  const spawnPtyMock = spawnPty as unknown as MockFn;
  spawnPtyMock.mockImplementation(() => {
    const pty = createMockPty(1000 + createdPtys.length);
    createdPtys.push(pty);
    return pty;
  });

  const spawnProcessMock = spawnProcess as unknown as MockFn;
  spawnProcessMock.mockImplementation((_command: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };

    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    process.nextTick(() => {
      child.stdout.emit('data', `C:/bin/${args[0]}.exe\n`);
      child.emit('close', 0);
    });

    return child;
  });

  insertValuesMock = vi.fn(async () => undefined);
  const insertMock = db.insert as unknown as MockFn;
  insertMock.mockReturnValue({ values: insertValuesMock });

  updateSetMock = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const updateMock = db.update as unknown as MockFn;
  updateMock.mockReturnValue({ set: updateSetMock });

  const selectMock = db.select as unknown as MockFn;
  selectMock.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => []),
      })),
      limit: vi.fn(async () => []),
    })),
  });

  resetSessionManagerState();
});

describe('session startup lifecycle', () => {
  it('creates claude session in running state during startup', async () => {
    const manager = SessionManager.getInstance();

    const session = await manager.create({
      type: 'claude',
      workdir: 'C:/Users/frand/Projects',
      flags: ['--yolo'],
    });

    expect(session.status).toBe('running');
    expect(session.command).toContain('claude.exe');
    expect(insertValuesMock).toHaveBeenCalledOnce();
    expect((TmuxWrapper.createSession as unknown as MockFn)).toHaveBeenCalledOnce();
    expect(createdPtys).toHaveLength(1);
  });

  it('updates lifecycle to stopped when startup pty exits with code 0', async () => {
    const manager = SessionManager.getInstance();

    const session = await manager.create({
      type: 'shell',
      workdir: 'C:/Users/frand/Projects',
      command: 'cmd.exe',
    });

    const startupPty = createdPtys.at(-1);
    expect(startupPty).toBeDefined();

    startupPty?.emitExit(0);

    expect(manager.get(session.id)?.status).toBe('stopped');
    expect(updateSetMock).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'stopped',
      exitCode: 0,
    }));
  });
});
