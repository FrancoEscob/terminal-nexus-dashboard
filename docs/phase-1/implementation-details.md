# Phase 1: Backend Core - Implementation Details

## Overview
Phase 1 implements the core backend functionality for the Terminal Nexus Dashboard, including terminal session management, real-time streaming, and REST API endpoints. This implementation provides the foundation for managing multiple terminal sessions through tmux with WebSocket-based real-time communication.

## Architecture

### Core Components

#### 1. tmux Wrapper (`lib/tmux.ts`)
The tmux wrapper provides a high-level interface for managing tmux sessions with isolated sockets.

**Key Features:**
- Each session gets its own socket file in `/tmp/terminal-nexus/`
- Supports creating, killing, resizing, and listing sessions
- Captures terminal output for history
- Sends keystrokes to sessions

**Critical Implementation Details:**
```typescript
// Sessions are spawned through node-pty for better control
const pty = spawn('tmux', [
  '-S', socketPath,  // Isolated socket per session
  'new-session',
  '-d',              // Detached mode
  '-s', name,
  '-c', workdir,
  command
], {
  env: { TMUX: '', TMUX_PANE: '' }  // Prevent nested tmux
});
```

**Why node-pty + tmux?**
- `tmux` provides persistence (sessions survive server restarts)
- `node-pty` gives us programmatic control and I/O streaming
- Combined approach gives us the best of both worlds

#### 2. SessionManager (`lib/session-manager.ts`)
A singleton class that manages all active terminal sessions in memory.

**Key Responsibilities:**
- Creates and tracks sessions in memory and database
- Handles pty events (data, exit, error)
- Maintains output buffer (last 1000 lines)
- Loads existing sessions on startup

**Session Lifecycle:**
1. **Creation**: Spawns tmux session via node-pty
2. **Tracking**: Stores in memory Map and SQLite database
3. **I/O Handling**: Pipes pty data to WebSocket
4. **Cleanup**: Kills pty and tmux session on request

**Critical Code Pattern:**
```typescript
// Event handling for real-time output
pty.onData((data) => {
  const outputs = this.sessionOutputs.get(sessionId);
  if (outputs) {
    outputs.push(data);
    // Keep buffer manageable
    if (outputs.length > 1000) {
      outputs.splice(0, outputs.length - 1000);
    }
    // Emit to WebSocket clients
    this.emitToSession(sessionId, 'terminal:output', data);
  }
});
```

#### 3. Socket.io Server (`lib/socket-server.ts`)
Provides real-time bidirectional communication between frontend and backend.

**Room-Based Architecture:**
- One Socket.io room per session (`session:${sessionId}`)
- Clients join/leave rooms to subscribe to terminal output
- Broadcasting ensures all viewers see the same output

**Event Flow:**
```
Client → Server: terminal:input → pty.write()
Server → Client: terminal:output ← pty.onData()
```

**Reconnection Strategy:**
- Automatic reconnection with exponential backoff
- Re-joins all previously watched sessions
- Sends recent history on rejoin

#### 4. REST API (`app/api/sessions/`)
Standard REST endpoints for session management.

**Endpoints:**
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/[id]` - Get session details
- `DELETE /api/sessions/[id]` - Kill session
- `POST /api/sessions/[id]/resize` - Resize terminal
- `POST /api/sessions/[id]/restart` - Restart session

**Security Measures:**
- Path validation for working directories
- Whitelist of allowed base directories
- Command injection prevention

## Data Flow

### Session Creation Flow
1. Client sends POST to `/api/sessions`
2. Server validates request and workdir path
3. SessionManager creates session:
   - Generates unique ID and socket path
   - Spawns tmux session via node-pty
   - Sets up event handlers
   - Saves to database
4. Socket.io broadcasts `session:created`
5. Client can join room to receive output

### Real-time Communication
1. Client joins room: `terminal:join`
2. Server sends recent output history
3. All pty output is broadcast to room members
4. Client input is written directly to pty
5. Session status changes are broadcast immediately

## Database Schema Integration

The implementation uses the existing SQLite schema:

```sql
sessions table:
- id: Primary key (UUID)
- name: Human-readable session name
- type: claude/droid/shell
- workdir: Working directory path
- socket_path: Path to tmux socket
- command: Full command executed
- flags: JSON array of flags
- pid: Process ID
- status: running/stopped/error
- created_at/updated_at: Timestamps
```

## Security Considerations

### Path Validation
```typescript
const ALLOWED_BASE_DIRS = [
  '/root/projects',
  '/home/fran/projects',
  '/tmp/experiments'
];

function validateWorkdir(input: string): string {
  const resolved = path.resolve(input);
  const isAllowed = ALLOWED_BASE_DIRS.some(base => 
    resolved.startsWith(base)
  );
  if (!isAllowed) {
    throw new Error(`Invalid workdir: ${input}`);
  }
  return resolved;
}
```

### Process Isolation
- Each session uses isolated tmux socket
- Environment variables cleared (TMUX, TMUX_PANE)
- Resource limits can be added (max sessions, memory)

## Error Handling

### Common Scenarios
1. **Session Creation Failure**: 
   - Cleans up partial resources
   - Returns descriptive error

2. **tmux Session Dies Unexpectedly**:
   - pty.onExit updates database status
   - Socket.io broadcasts status change

3. **Socket Disconnection**:
   - Graceful cleanup of room memberships
   - Sessions continue running in tmux

## Testing the Implementation

### Manual Testing Steps

1. **Start the server:**
   ```bash
   pnpm dev
   ```

2. **Check health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Create a session:**
   ```bash
   curl -X POST http://localhost:3000/api/sessions \
     -H "Content-Type: application/json" \
     -d '{
       "type": "shell",
       "workdir": "/tmp",
       "name": "test-session"
     }'
   ```

4. **List sessions:**
   ```bash
   curl http://localhost:3000/api/sessions
   ```

5. **WebSocket connection:**
   - Connect to `ws://localhost:3000/api/socket`
   - Join room: `terminal:join [session-id]`
   - Send input: `terminal:input [session-id] "ls -la"`

## Connection to Frontend (Phase 2)

The backend is designed to seamlessly integrate with the frontend:

1. **REST API** provides session CRUD operations
2. **Socket.io** provides real-time terminal streaming
3. **Type definitions** ensure type safety across the stack
4. **Event-driven architecture** enables reactive UI updates

## Performance Optimizations

1. **Output Buffering**: Only last 1000 lines kept in memory
2. **Binary WebSocket**: Terminal data sent as binary for efficiency
3. **Room Isolation**: Only interested clients receive data
4. **Lazy Loading**: Sessions loaded on demand from database

## Future Enhancements

1. **Authentication**: API token or OAuth integration
2. **Resource Limits**: CPU/memory per session
3. **Session Templates**: Saved configurations
4. **Multi-Server Support**: Remote tmux sessions
5. **Recording/Replay**: Session recording functionality

## Troubleshooting

### Common Issues

1. **tmux not found**: Install tmux on the system
2. **Permission denied**: Check socket directory permissions
3. **Session not responding**: Check if tmux session still exists
4. **WebSocket connection fails**: Check firewall/proxy settings

### Debug Commands

```bash
# List tmux sessions
tmux -S /tmp/terminal-nexus/[session-id].sock list-sessions

# Check process tree
ps aux | grep tmux

# Monitor socket directory
ls -la /tmp/terminal-nexus/
```

## Summary

Phase 1 successfully implements a robust backend for terminal session management with:
- ✅ tmux integration with isolated sockets
- ✅ SessionManager singleton for lifecycle management
- ✅ REST API for CRUD operations
- ✅ Socket.io for real-time streaming
- ✅ Security measures and error handling
- ✅ Database persistence
- ✅ Type safety throughout

The backend is now ready for Phase 2 frontend implementation, which will build upon these solid foundations to create an interactive terminal dashboard.
