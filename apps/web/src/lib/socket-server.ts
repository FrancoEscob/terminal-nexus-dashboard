import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { sessionManager } from './session-manager';
import type { ServerToClientEvents, ClientToServerEvents, SocketUser } from './types';
import { logRuntimeLifecycle } from './runtime-lifecycle-logger';

export const SocketHandler = (req: NextApiRequest, res: NextApiResponse & { socket: any }) => {
  if (res.socket.server.io) {
    logRuntimeLifecycle({
      event: 'socket_server_already_initialized',
      runtime: 'tmux',
      source: 'socket-server#SocketHandler',
    });
    res.end();
    return;
  }

  logRuntimeLifecycle({
    event: 'socket_server_initializing',
    runtime: 'tmux',
    source: 'socket-server#SocketHandler',
  });
  
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(res.socket.server, {
    path: '/api/socket-io',
    addTrailingSlash: false,
    transports: ['websocket', 'polling']
  });

  // Store user sessions
  const users = new Map<string, SocketUser>();
  const forwardedSessionPids = new Map<string, number>();

  io.on('connection', (socket) => {
    logRuntimeLifecycle({
      event: 'socket_client_connected',
      runtime: 'tmux',
      source: 'socket-server#connection',
      metadata: { socketId: socket.id },
    });
    
    // Create user object
    const user: SocketUser = {
      id: socket.id,
      joinedSessions: new Set()
    };
    users.set(socket.id, user);

    // Handle joining a terminal session
    socket.on('terminal:join', async (sessionId: string) => {
      logRuntimeLifecycle({
        event: 'socket_terminal_join_requested',
        sessionId,
        runtime: 'tmux',
        source: 'socket-server#terminal:join',
        metadata: { socketId: socket.id },
      });

      try {
        const session = await sessionManager.ensureActiveSession(sessionId);
        if (!session) {
          socket.emit('terminal:status', sessionId, 'error');

          logRuntimeLifecycle({
            event: 'socket_terminal_join_rejected',
            sessionId,
            runtime: 'tmux',
            status: 'failed',
            source: 'socket-server#terminal:join',
            reason: 'session_unavailable',
            level: 'warn',
            metadata: { socketId: socket.id },
          });

          return;
        }

        // Join socket room for this session
        socket.join(`session:${sessionId}`);
        user.joinedSessions.add(sessionId);

        // Send current status
        socket.emit('terminal:status', sessionId, session.status);

        // Ensure this session is wired for realtime room forwarding even if it was
        // created before Socket.io initialized.
        if (session.pty) {
          const ptyPid = session.pty.pid;
          const forwardedPid = forwardedSessionPids.get(session.id);

          if (forwardedPid !== ptyPid) {
            const attachedPty = session.pty;
            forwardedSessionPids.set(session.id, ptyPid);

            attachedPty.onData((data) => {
              if (forwardedSessionPids.get(session.id) !== ptyPid) {
                return;
              }

              io.to(`session:${session.id}`).emit('terminal:output', session.id, data);
            });

            attachedPty.onExit(({ exitCode }) => {
              if (forwardedSessionPids.get(session.id) !== ptyPid) {
                return;
              }

              io.to(`session:${session.id}`).emit('terminal:exited', session.id, exitCode);
              io.to(`session:${session.id}`).emit('terminal:status', session.id, exitCode === 0 ? 'stopped' : 'error');
              forwardedSessionPids.delete(session.id);
            });
          }
        }

        // Send recent output history
        const recentOutput = sessionManager.getRecentOutput(sessionId, 100);
        for (const line of recentOutput) {
          socket.emit('terminal:output', sessionId, line);
        }

        logRuntimeLifecycle({
          event: 'socket_terminal_join_completed',
          sessionId,
          sessionType: session.type,
          runtime: 'tmux',
          status: session.status,
          source: 'socket-server#terminal:join',
          metadata: {
            socketId: socket.id,
            replayedLines: recentOutput.length,
          },
        });
      } catch (error) {
        logRuntimeLifecycle({
          event: 'socket_terminal_join_failed',
          sessionId,
          runtime: 'tmux',
          status: 'failed',
          source: 'socket-server#terminal:join',
          reason: error instanceof Error ? error.message : String(error),
          level: 'error',
          metadata: { socketId: socket.id },
        });
        socket.emit('terminal:status', sessionId, 'error');
      }
    });

    // Handle leaving a terminal session
    socket.on('terminal:leave', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
      user.joinedSessions.delete(sessionId);

      logRuntimeLifecycle({
        event: 'socket_terminal_leave',
        sessionId,
        runtime: 'tmux',
        source: 'socket-server#terminal:leave',
        metadata: { socketId: socket.id },
      });
    });

    // Handle terminal input
    socket.on('terminal:input', async (sessionId: string, data: string) => {
      const session = await sessionManager.ensureActiveSession(sessionId);
      if (session && session.pty) {
        session.pty.write(data);
      }
    });

    // Handle terminal resize
    socket.on('terminal:resize', async (sessionId: string, cols: number, rows: number) => {
      try {
        await sessionManager.resize(sessionId, cols, rows);
        
        // Broadcast resize to all clients in the session
        io.to(`session:${sessionId}`).emit('terminal:resize', sessionId, cols, rows);

        logRuntimeLifecycle({
          event: 'socket_terminal_resize_forwarded',
          sessionId,
          runtime: 'tmux',
          source: 'socket-server#terminal:resize',
          metadata: {
            socketId: socket.id,
            cols,
            rows,
          },
        });
      } catch (error) {
        logRuntimeLifecycle({
          event: 'socket_terminal_resize_failed',
          sessionId,
          runtime: 'tmux',
          status: 'failed',
          source: 'socket-server#terminal:resize',
          reason: error instanceof Error ? error.message : String(error),
          level: 'error',
          metadata: {
            socketId: socket.id,
            cols,
            rows,
          },
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logRuntimeLifecycle({
        event: 'socket_client_disconnected',
        runtime: 'tmux',
        source: 'socket-server#disconnect',
        metadata: {
          socketId: socket.id,
          joinedSessions: Array.from(user.joinedSessions),
        },
      });
      
      // Leave all sessions
      for (const sessionId of user.joinedSessions) {
        socket.leave(`session:${sessionId}`);
      }
      
      users.delete(socket.id);
    });
  });

  res.socket.server.io = io;
  res.end();
};

// Helper function to get socket.io instance from server
export function getSocketIO(req: NextApiRequest): SocketIOServer | null {
  const socket = (req as any).socket?.server;
  return socket?.io || null;
}
