import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { sessionManager } from './session-manager';
import type { ServerToClientEvents, ClientToServerEvents, SocketUser } from './types';

export const SocketHandler = (req: NextApiRequest, res: NextApiResponse & { socket: any }) => {
  if (res.socket.server.io) {
    console.log('Socket.io already initialized');
    res.end();
    return;
  }

  console.log('Initializing Socket.io server...');
  
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(res.socket.server, {
    path: '/api/socket-io',
    addTrailingSlash: false,
    transports: ['websocket', 'polling']
  });

  // Store user sessions
  const users = new Map<string, SocketUser>();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Create user object
    const user: SocketUser = {
      id: socket.id,
      joinedSessions: new Set()
    };
    users.set(socket.id, user);

    // Handle joining a terminal session
    socket.on('terminal:join', async (sessionId: string) => {
      try {
        const session = sessionManager.get(sessionId);
        if (!session) {
          socket.emit('terminal:status', sessionId, 'error');
          return;
        }

        // Join socket room for this session
        socket.join(`session:${sessionId}`);
        user.joinedSessions.add(sessionId);

        // Send current status
        socket.emit('terminal:status', sessionId, session.status);

        // Send recent output history
        const recentOutput = sessionManager.getRecentOutput(sessionId, 100);
        for (const line of recentOutput) {
          socket.emit('terminal:output', sessionId, line);
        }

        console.log(`User ${socket.id} joined session ${sessionId}`);
      } catch (error) {
        console.error(`Error joining session ${sessionId}:`, error);
        socket.emit('terminal:status', sessionId, 'error');
      }
    });

    // Handle leaving a terminal session
    socket.on('terminal:leave', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
      user.joinedSessions.delete(sessionId);
      console.log(`User ${socket.id} left session ${sessionId}`);
    });

    // Handle terminal input
    socket.on('terminal:input', (sessionId: string, data: string) => {
      const session = sessionManager.get(sessionId);
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
      } catch (error) {
        console.error(`Error resizing session ${sessionId}:`, error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      
      // Leave all sessions
      for (const sessionId of user.joinedSessions) {
        socket.leave(`session:${sessionId}`);
      }
      
      users.delete(socket.id);
    });
  });

  // Extend session manager to emit socket events
  const originalCreate = sessionManager.create.bind(sessionManager);
  sessionManager.create = async (config) => {
    const session = await originalCreate(config);
    
    // Set up real-time output forwarding
    if (session.pty) {
      session.pty.onData((data) => {
        io.to(`session:${session.id}`).emit('terminal:output', session.id, data);
      });
    }
    
    // Set up exit event forwarding
    if (session.pty) {
      session.pty.onExit(({ exitCode }: { exitCode: number }) => {
        io.to(`session:${session.id}`).emit('terminal:exited', session.id, exitCode);
        io.to(`session:${session.id}`).emit('terminal:status', session.id, exitCode === 0 ? 'stopped' : 'error');
      });
    }
    
    // Broadcast session creation
    io.emit('session:created', session);
    
    return session;
  };

  const originalKill = sessionManager.kill.bind(sessionManager);
  sessionManager.kill = async (sessionId) => {
    await originalKill(sessionId);
    
    // Broadcast session kill
    io.emit('session:killed', sessionId);
    io.to(`session:${sessionId}`).emit('terminal:status', sessionId, 'stopped');
  };

  const originalResize = sessionManager.resize.bind(sessionManager);
  sessionManager.resize = async (sessionId, cols, rows) => {
    await originalResize(sessionId, cols, rows);
    
    // Broadcast resize to all clients in session
    io.to(`session:${sessionId}`).emit('terminal:resize', sessionId, cols, rows);
  };

  res.socket.server.io = io;
  res.end();
};

// Helper function to get socket.io instance from server
export function getSocketIO(req: NextApiRequest): SocketIOServer | null {
  const socket = (req as any).socket?.server;
  return socket?.io || null;
}
