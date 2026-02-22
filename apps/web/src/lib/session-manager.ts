import { spawn, IPty } from 'node-pty';
import { randomUUID } from 'crypto';
import { spawn as spawnProcess } from 'child_process';
import { db } from './db';
import { sessions } from './db/schema';
import { TmuxWrapper } from './tmux';
import type { Session, SessionCreateRequest } from './types';
import { eq } from 'drizzle-orm';

interface SessionCreateConfig extends SessionCreateRequest {
  id?: string;
  socketPath?: string;
}

export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<string, Session> = new Map();
  private sessionOutputs: Map<string, string[]> = new Map();
  private activePtyPids: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async create(config: SessionCreateConfig): Promise<Session> {
    const sessionId = config.id || randomUUID();
    const socketPath = config.socketPath || TmuxWrapper.generateSocketPath(sessionId);
    
    // Generate session name
    const sessionName = config.name || `${config.type}-${sessionId.slice(0, 8)}`;
    
    try {
      // Build command based on type
      let command: string;
      switch (config.type) {
        case 'claude': {
          const claudeBinary = await this.resolveCommandBinary('claude');
          command = [
            claudeBinary,
            config.flags?.includes('--yolo') ? '--yolo' : null,
            config.flags?.includes('--full-auto') ? '--full-auto' : null,
          ]
            .filter(Boolean)
            .join(' ');
          break;
        }
        case 'droid': {
          const droidBinary = await this.resolveCommandBinary('droid');
          command = droidBinary;
          break;
        }
        case 'shell':
          command = config.command || (process.platform === 'win32' ? 'cmd.exe' : '/bin/bash');
          break;
        default:
          throw new Error(`Unknown session type: ${config.type}`);
      }

      // Create tmux session
      const tmuxSession = await TmuxWrapper.createSession({
        name: sessionName,
        workdir: config.workdir,
        command,
        socketPath,
        cols: config.cols || 80,
        rows: config.rows || 24
      });
      const tmuxBinary = TmuxWrapper.getTmuxBinary();

      // Spawn pty for the tmux session
      const pty = spawn(tmuxBinary, [
        '-S', socketPath,
        'attach-session',
        '-t', sessionName
      ], {
        name: 'xterm-color',
        cols: config.cols || 80,
        rows: config.rows || 24,
        cwd: config.workdir,
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          TMUX: '',
          TMUX_PANE: ''
        }
      });

      // Create session object
      const session: Session = {
        id: sessionId,
        name: sessionName,
        type: config.type,
        workdir: config.workdir,
        command,
        flags: config.flags || [],
        status: 'running',
        pid: pty.pid,
        socketPath,
        pty,
        tmuxSession: tmuxSession,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in memory
      this.activeSessions.set(sessionId, session);
      this.sessionOutputs.set(sessionId, []);

      // Set up event handlers
      this.setupPtyHandlers(sessionId, pty);

      // Save to database
      const persistedSession = {
        name: sessionName,
        type: config.type,
        workdir: config.workdir,
        socketPath,
        command,
        flags: JSON.stringify(config.flags || []),
        pid: pty.pid,
        status: 'running' as const,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };

      if (config.id) {
        const [existingSession] = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .limit(1);

        if (existingSession) {
          await db.update(sessions)
            .set(persistedSession)
            .where(eq(sessions.id, sessionId));
        } else {
          await db.insert(sessions).values({
            id: sessionId,
            ...persistedSession,
          });
        }
      } else {
        await db.insert(sessions).values({
          id: sessionId,
          ...persistedSession,
        });
      }

      return session;
    } catch (error) {
      // Clean up on failure
      try {
        await TmuxWrapper.killSession(sessionName, socketPath);
      } catch {}
      
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async kill(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      const [persistedSession] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      if (!persistedSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (persistedSession.status === 'running') {
        try {
          await TmuxWrapper.killSession(persistedSession.name, persistedSession.socketPath);
        } catch (error) {
          if (!this.isIgnorableKillError(error)) {
            throw error;
          }
        }
      }

      await db.update(sessions)
        .set({
          status: 'stopped',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      this.activePtyPids.delete(sessionId);
      this.sessionOutputs.delete(sessionId);
      return;
    }

    try {
      // Kill the pty
      if (session.pty) {
        try {
          session.pty.kill();
        } catch {}
      }

      // Kill tmux session
      if (session.tmuxSession && session.socketPath) {
        try {
          await TmuxWrapper.killSession(session.tmuxSession, session.socketPath);
        } catch (error) {
          if (!this.isIgnorableKillError(error)) {
            throw error;
          }
        }
      }

      // Update status
      session.status = 'stopped';
      session.updatedAt = new Date();

      // Update database
      await db.update(sessions)
        .set({ 
          status: 'stopped', 
          updatedAt: session.updatedAt 
        })
        .where(eq(sessions.id, sessionId));

      // Remove from memory
      this.activeSessions.delete(sessionId);
      this.activePtyPids.delete(sessionId);
      this.sessionOutputs.delete(sessionId);
    } catch (error) {
      throw new Error(`Failed to kill session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      const [persistedSession] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      if (!persistedSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (persistedSession.status !== 'running') {
        return;
      }

      await TmuxWrapper.resizeSession(persistedSession.name, cols, rows, persistedSession.socketPath);
      await db.update(sessions)
        .set({ updatedAt: new Date() })
        .where(eq(sessions.id, sessionId));
      return;
    }

    try {
      // Resize pty
      if (session.pty) {
        session.pty.resize(cols, rows);
      }

      // Resize tmux session
      if (session.tmuxSession && session.socketPath) {
        await TmuxWrapper.resizeSession(session.tmuxSession, cols, rows, session.socketPath);
      }

      session.updatedAt = new Date();
    } catch (error) {
      throw new Error(`Failed to resize session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  get(sessionId: string): Session | undefined {
    return this.activeSessions.get(sessionId);
  }

  async ensureActiveSession(sessionId: string): Promise<Session | undefined> {
    const existing = this.activeSessions.get(sessionId);
    if (existing) return existing;

    const [sessionData] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!sessionData || sessionData.status !== 'running') {
      return undefined;
    }

    const tmuxSessions = await TmuxWrapper.listSessions(sessionData.socketPath);
    const tmuxSession = tmuxSessions.find((entry) => entry.name === sessionData.name);
    if (!tmuxSession) {
      await db.update(sessions)
        .set({ status: 'stopped', updatedAt: new Date() })
        .where(eq(sessions.id, sessionId));
      return undefined;
    }

    const tmuxBinary = TmuxWrapper.getTmuxBinary();
    const pty = spawn(tmuxBinary, [
      '-S', sessionData.socketPath,
      'attach-session',
      '-t', sessionData.name,
    ], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: sessionData.workdir,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        TMUX: '',
        TMUX_PANE: '',
      },
    });

    const recoveredSession: Session = {
      id: sessionData.id,
      name: sessionData.name,
      type: sessionData.type as any,
      workdir: sessionData.workdir,
      command: sessionData.command,
      flags: JSON.parse(sessionData.flags || '[]'),
      status: 'running',
      pid: pty.pid,
      socketPath: sessionData.socketPath,
      pty,
      tmuxSession: sessionData.name,
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt,
      exitCode: sessionData.exitCode ?? undefined,
    };

    this.activeSessions.set(sessionData.id, recoveredSession);
    this.sessionOutputs.set(sessionData.id, []);
    this.setupPtyHandlers(sessionData.id, pty);

    return recoveredSession;
  }

  getAll(): Session[] {
    return Array.from(this.activeSessions.values());
  }

  getRecentOutput(sessionId: string, lines: number = 100): string[] {
    const output = this.sessionOutputs.get(sessionId) || [];
    return output.slice(-lines);
  }

  private setupPtyHandlers(sessionId: string, pty: IPty): void {
    const ptyPid = pty.pid;
    this.activePtyPids.set(sessionId, ptyPid);

    // Handle data output
    pty.onData((data) => {
      if (this.activePtyPids.get(sessionId) !== ptyPid) {
        return;
      }

      const outputs = this.sessionOutputs.get(sessionId);
      if (outputs) {
        outputs.push(data);
        
        // Keep only last 1000 lines in memory
        if (outputs.length > 1000) {
          outputs.splice(0, outputs.length - 1000);
        }

        // TODO: Emit to WebSocket clients
        // this.emitToSession(sessionId, 'terminal:output', data);
      }
    });

    // Handle exit
    pty.onExit(({ exitCode }) => {
      if (this.activePtyPids.get(sessionId) !== ptyPid) {
        return;
      }

      this.activePtyPids.delete(sessionId);

      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = exitCode === 0 ? 'stopped' : 'error';
        session.exitCode = exitCode;
        session.updatedAt = new Date();

        // Update database
        db.update(sessions)
          .set({ 
            status: session.status,
            exitCode,
            updatedAt: session.updatedAt 
          })
          .where(eq(sessions.id, sessionId))
          .catch(console.error);

        // TODO: Emit to WebSocket clients
        // this.emitToSession(sessionId, 'terminal:exited', exitCode);
      }
    });
  }

  private isIgnorableKillError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return (
      message.includes('no server running')
      || message.includes("can't find session")
      || message.includes('failed to connect to server')
      || message.includes('no such file or directory')
    );
  }

  private async resolveCommandBinary(binary: 'claude' | 'droid'): Promise<string> {
    const probeCommand = process.platform === 'win32' ? 'where' : 'which';
    return new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const probe = spawnProcess(probeCommand, [binary], {
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        },
      });

      probe.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      probe.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      probe.on('error', (error) => reject(error));
      probe.on('close', (code) => {
        if (code !== 0) {
          const details = stderr.trim() || stdout.trim() || `${probeCommand} returned exit code ${code}`;
          reject(new Error(`Required command '${binary}' is not available in PATH (${details}).`));
          return;
        }

        const firstPath = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);

        if (!firstPath) {
          reject(new Error(`Required command '${binary}' is not available in PATH.`));
          return;
        }

        resolve(firstPath);
      });
    });
  }

  async loadExistingSessions(): Promise<void> {
    try {
      const existingSessions = await db.select().from(sessions);
      
      for (const sessionData of existingSessions) {
        if (sessionData.status === 'running') {
          // Try to reconnect to existing tmux sessions
          const socketPath = sessionData.socketPath;
          try {
            const tmuxSessions = await TmuxWrapper.listSessions(socketPath);
            const tmuxSession = tmuxSessions.find(s => s.name === sessionData.name);
            
            if (tmuxSession) {
              const tmuxBinary = TmuxWrapper.getTmuxBinary();
              // Reattach to existing session
              const pty = spawn(tmuxBinary, [
                '-S', socketPath,
                'attach-session',
                '-t', sessionData.name
              ], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: sessionData.workdir,
                env: {
                  ...process.env,
                  PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                  TMUX: '',
                  TMUX_PANE: ''
                }
              });

              const session: Session = {
                id: sessionData.id,
                name: sessionData.name,
                type: sessionData.type as any,
                workdir: sessionData.workdir,
                command: sessionData.command,
                flags: JSON.parse(sessionData.flags || '[]'),
                status: 'running',
                pid: sessionData.pid || undefined,
                socketPath,
                pty,
                tmuxSession: sessionData.name,
                createdAt: sessionData.createdAt,
                updatedAt: sessionData.updatedAt
              };

              this.activeSessions.set(sessionData.id, session);
              this.sessionOutputs.set(sessionData.id, []);
              this.setupPtyHandlers(sessionData.id, pty);
            } else {
              await db.update(sessions)
                .set({ status: 'stopped', updatedAt: new Date() })
                .where(eq(sessions.id, sessionData.id));
            }
          } catch (error) {
            // Mark as stopped if can't reconnect
            await db.update(sessions)
              .set({ status: 'stopped', updatedAt: new Date() })
              .where(eq(sessions.id, sessionData.id));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load existing sessions:', error);
    }
  }
}

export const sessionManager = SessionManager.getInstance();
