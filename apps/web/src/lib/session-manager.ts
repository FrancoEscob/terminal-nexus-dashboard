import { spawn, IPty } from 'node-pty';
import { randomUUID } from 'crypto';
import { db } from './db';
import { sessions, logs } from './db/schema';
import { TmuxWrapper } from './tmux';
import type { Session, SessionConfig, SessionCreateRequest } from './types';
import { eq } from 'drizzle-orm';

export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<string, Session> = new Map();
  private sessionOutputs: Map<string, string[]> = new Map();

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async create(config: SessionCreateRequest): Promise<Session> {
    const sessionId = randomUUID();
    const socketPath = TmuxWrapper.generateSocketPath(sessionId);
    
    // Generate session name
    const sessionName = config.name || `${config.type}-${sessionId.slice(0, 8)}`;
    
    // Build command based on type
    let command: string;
    switch (config.type) {
      case 'claude':
        command = `claude ${config.flags?.includes('--yolo') ? '--yolo' : ''} ${config.flags?.includes('--full-auto') ? '--full-auto' : ''} --workdir ${config.workdir}`.trim();
        break;
      case 'droid':
        command = `droid ${config.workdir}`;
        break;
      case 'shell':
        command = config.command || (process.platform === 'win32' ? 'cmd.exe' : '/bin/bash');
        break;
      default:
        throw new Error(`Unknown session type: ${config.type}`);
    }

    try {
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
      await db.insert(sessions).values({
        id: sessionId,
        name: sessionName,
        type: config.type,
        workdir: config.workdir,
        socketPath,
        command,
        flags: JSON.stringify(config.flags || []),
        pid: pty.pid,
        status: 'running',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      });

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
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      // Kill the pty
      if (session.pty) {
        session.pty.kill();
      }

      // Kill tmux session
      if (session.tmuxSession && session.socketPath) {
        await TmuxWrapper.killSession(session.tmuxSession, session.socketPath);
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
    // Handle data output
    pty.onData((data) => {
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
