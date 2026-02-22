import { spawn, IPty } from 'node-pty';
import { randomUUID } from 'crypto';
import { spawn as spawnProcess } from 'child_process';
import { db } from './db';
import { sessions } from './db/schema';
import { TmuxWrapper } from './tmux';
import type { Session, SessionCreateRequest } from './types';
import { eq } from 'drizzle-orm';
import { logRuntimeLifecycle } from './runtime-lifecycle-logger';

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

    logRuntimeLifecycle({
      event: 'session_create_requested',
      sessionId,
      sessionType: config.type,
      runtime: 'tmux',
      status: 'creating',
      source: 'session-manager#create',
      metadata: {
        hasCustomId: Boolean(config.id),
      },
    });
    
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

      logRuntimeLifecycle({
        event: 'session_create_completed',
        sessionId,
        sessionType: config.type,
        runtime: 'tmux',
        status: 'running',
        source: 'session-manager#create',
      });

      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logRuntimeLifecycle({
        event: 'session_create_failed',
        sessionId,
        sessionType: config.type,
        runtime: 'tmux',
        status: 'failed',
        source: 'session-manager#create',
        reason: message,
        level: 'error',
      });

      // Clean up on failure
      try {
        await TmuxWrapper.killSession(sessionName, socketPath);
      } catch {}
      
      throw new Error(`Failed to create session: ${message}`);
    }
  }

  async kill(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    logRuntimeLifecycle({
      event: 'session_kill_requested',
      sessionId,
      runtime: 'tmux',
      source: 'session-manager#kill',
    });

    if (!session) {
      const [persistedSession] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      if (!persistedSession) {
        logRuntimeLifecycle({
          event: 'session_kill_missing',
          sessionId,
          runtime: 'tmux',
          source: 'session-manager#kill',
          reason: 'session_not_found',
          level: 'warn',
        });
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

      logRuntimeLifecycle({
        event: 'session_kill_completed_from_db',
        sessionId,
        sessionType: persistedSession.type as SessionCreateRequest['type'],
        runtime: 'tmux',
        status: 'stopped',
        source: 'session-manager#kill',
      });

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

      logRuntimeLifecycle({
        event: 'session_kill_completed',
        sessionId,
        sessionType: session.type,
        runtime: 'tmux',
        status: 'stopped',
        source: 'session-manager#kill',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logRuntimeLifecycle({
        event: 'session_kill_failed',
        sessionId,
        sessionType: session.type,
        runtime: 'tmux',
        status: 'failed',
        source: 'session-manager#kill',
        reason: message,
        level: 'error',
      });

      throw new Error(`Failed to kill session: ${message}`);
    }
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    logRuntimeLifecycle({
      event: 'session_resize_requested',
      sessionId,
      sessionType: session?.type,
      runtime: 'tmux',
      source: 'session-manager#resize',
      metadata: { cols, rows },
    });

    if (!session) {
      const [persistedSession] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      if (!persistedSession) {
        logRuntimeLifecycle({
          event: 'session_resize_missing',
          sessionId,
          runtime: 'tmux',
          source: 'session-manager#resize',
          reason: 'session_not_found',
          level: 'warn',
        });
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (persistedSession.status !== 'running') {
        logRuntimeLifecycle({
          event: 'session_resize_skipped',
          sessionId,
          sessionType: persistedSession.type as SessionCreateRequest['type'],
          runtime: 'tmux',
          status: persistedSession.status as Session['status'],
          source: 'session-manager#resize',
          reason: 'session_not_running',
          level: 'warn',
        });
        return;
      }

      await TmuxWrapper.resizeSession(persistedSession.name, cols, rows, persistedSession.socketPath);
      await db.update(sessions)
        .set({ updatedAt: new Date() })
        .where(eq(sessions.id, sessionId));

      logRuntimeLifecycle({
        event: 'session_resize_completed_from_db',
        sessionId,
        sessionType: persistedSession.type as SessionCreateRequest['type'],
        runtime: 'tmux',
        status: 'running',
        source: 'session-manager#resize',
        metadata: { cols, rows },
      });

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

      logRuntimeLifecycle({
        event: 'session_resize_completed',
        sessionId,
        sessionType: session.type,
        runtime: 'tmux',
        status: session.status,
        source: 'session-manager#resize',
        metadata: { cols, rows },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logRuntimeLifecycle({
        event: 'session_resize_failed',
        sessionId,
        sessionType: session.type,
        runtime: 'tmux',
        status: 'failed',
        source: 'session-manager#resize',
        reason: message,
        metadata: { cols, rows },
        level: 'error',
      });

      throw new Error(`Failed to resize session: ${message}`);
    }
  }

  get(sessionId: string): Session | undefined {
    return this.activeSessions.get(sessionId);
  }

  async ensureActiveSession(sessionId: string): Promise<Session | undefined> {
    const existing = this.activeSessions.get(sessionId);
    if (existing) {
      logRuntimeLifecycle({
        event: 'session_reconnect_cache_hit',
        sessionId,
        sessionType: existing.type,
        runtime: 'tmux',
        status: existing.status,
        source: 'session-manager#ensureActiveSession',
      });
      return existing;
    }

    const [sessionData] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!sessionData || sessionData.status !== 'running') {
      logRuntimeLifecycle({
        event: 'session_reconnect_unavailable',
        sessionId,
        runtime: 'tmux',
        source: 'session-manager#ensureActiveSession',
        reason: !sessionData ? 'session_not_found' : 'session_not_running',
        level: 'warn',
      });
      return undefined;
    }

    const tmuxSessions = await TmuxWrapper.listSessions(sessionData.socketPath);
    const tmuxSession = tmuxSessions.find((entry) => entry.name === sessionData.name);
    if (!tmuxSession) {
      await db.update(sessions)
        .set({ status: 'stopped', updatedAt: new Date() })
        .where(eq(sessions.id, sessionId));

      logRuntimeLifecycle({
        event: 'session_reconnect_tmux_missing',
        sessionId,
        sessionType: sessionData.type as SessionCreateRequest['type'],
        runtime: 'tmux',
        status: 'stopped',
        source: 'session-manager#ensureActiveSession',
        reason: 'tmux_session_not_found',
        level: 'warn',
      });

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

    logRuntimeLifecycle({
      event: 'session_reconnect_completed',
      sessionId: sessionData.id,
      sessionType: sessionData.type as SessionCreateRequest['type'],
      runtime: 'tmux',
      status: 'running',
      source: 'session-manager#ensureActiveSession',
    });

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

        logRuntimeLifecycle({
          event: 'session_pty_exited',
          sessionId,
          sessionType: session.type,
          runtime: 'tmux',
          status: session.status,
          exitCode,
          source: 'session-manager#setupPtyHandlers',
        });

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

      logRuntimeLifecycle({
        event: 'session_bootstrap_started',
        runtime: 'tmux',
        source: 'session-manager#loadExistingSessions',
        metadata: { totalPersistedSessions: existingSessions.length },
      });
      
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

              logRuntimeLifecycle({
                event: 'session_bootstrap_reconnected',
                sessionId: sessionData.id,
                sessionType: sessionData.type as SessionCreateRequest['type'],
                runtime: 'tmux',
                status: 'running',
                source: 'session-manager#loadExistingSessions',
              });
            } else {
              await db.update(sessions)
                .set({ status: 'stopped', updatedAt: new Date() })
                .where(eq(sessions.id, sessionData.id));

              logRuntimeLifecycle({
                event: 'session_bootstrap_marked_stopped',
                sessionId: sessionData.id,
                sessionType: sessionData.type as SessionCreateRequest['type'],
                runtime: 'tmux',
                status: 'stopped',
                source: 'session-manager#loadExistingSessions',
                reason: 'tmux_session_not_found',
                level: 'warn',
              });
            }
          } catch (error) {
            // Mark as stopped if can't reconnect
            await db.update(sessions)
              .set({ status: 'stopped', updatedAt: new Date() })
              .where(eq(sessions.id, sessionData.id));

            logRuntimeLifecycle({
              event: 'session_bootstrap_failed',
              sessionId: sessionData.id,
              sessionType: sessionData.type as SessionCreateRequest['type'],
              runtime: 'tmux',
              status: 'failed',
              source: 'session-manager#loadExistingSessions',
              reason: error instanceof Error ? error.message : String(error),
              level: 'error',
            });
          }
        }
      }
    } catch (error) {
      logRuntimeLifecycle({
        event: 'session_bootstrap_crashed',
        runtime: 'tmux',
        status: 'failed',
        source: 'session-manager#loadExistingSessions',
        reason: error instanceof Error ? error.message : String(error),
        level: 'error',
      });
      console.error('Failed to load existing sessions:', error);
    }
  }
}

export const sessionManager = SessionManager.getInstance();
