# 🏗️ ARCHITECTURE.md - Terminal Nexus Dashboard

**Deep Dive Técnico**  
**Versión:** 1.0  
**Fecha:** 2026-02-16  

---

## 1. Overview de Arquitectura

### 1.1 Principios
1. **Streaming local, sync global:** Socket.io para terminales (<1ms), Convex para estado compartido
2. **Event-Driven:** Todo cambio se propaga vía WebSocket
3. **Separation of Concerns:** Backend maneja procesos, frontend maneja UI, Convex maneja sync
4. **Fail-Safe:** Si el dashboard muere, las sesiones continúan

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────────────────┐  │
│  │  Socket.io   │     │   Convex     │     │      Convex Hooks          │  │
│  │  (streaming) │     │  (presence)  │     │  (presence/layout/logs)    │  │
│  │  Terminal    │     │  Audit logs  │     │                            │  │
│  │  bytes       │     │  Sync state  │     │                            │  │
│  └──────┬───────┘     └──────┬───────┘     └────────────────────────────┘  │
└─────────┼────────────────────┼──────────────────────────────────────────────┘
          │                    │
          ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│  Next.js API     │  │  Convex Cloud    │
│  (node-pty/tmux) │  │  (state sync)    │
└──────────────────┘  └──────────────────┘
```

### 1.3 Responsabilidades de cada tecnología

| Dato | Tecnología | Razón |
|------|-----------|-------|
| **Output de terminal** (bytes ANSI) | Socket.io local | Latencia <1ms, streaming binario |
| **Input/keystrokes** | Socket.io local | Tiempo real, sin delay |
| **Presencia** (quién ve qué) | Convex | Sync entre tabs/devices automático |
| **Audit logs** (quién hizo qué) | Convex | Inmutable, queryable, historial |
| **Layout del grid** | Convex | Persiste entre sesiones, sync cross-device |
| **Templates** | Convex | CRUD simple, compartible |
| **Command history** | Convex | Búsqueda global, autocomplete |
| **Notificaciones** | Convex | Push cross-device cuando termina sesión |

---

## 2. Componentes Detallados

### 2.1 Frontend (Next.js 15 App Router)

#### Estructura de Directorios
```
app/
├── page.tsx                    # Dashboard gallery (Server Component)
├── layout.tsx                  # Providers + global styles
├── globals.css                 # Tailwind + xterm.css
├── terminal/
│   └── [id]/
│       └── page.tsx            # Full terminal view
└── api/
    ├── sessions/
    │   ├── route.ts            # GET/POST
    │   └── [id]/
    │       └── route.ts        # GET/DELETE/PATCH
    └── socket/route.ts         # Socket.io handler
```

#### State Management
- **SWR/React Query:** Para fetching de datos REST (sessions list)
- **Zustand:** Estado global UI (selected session, modal states)
- **Socket.io Client:** WebSocket connection singleton

#### Componentes Clave

**TerminalGrid.tsx**
```typescript
// Masonry layout usando CSS Grid con auto-fill
// Cada tile es un TerminalTile
// Drag & drop usando @dnd-kit/core
// Resize usando react-resizable
```

**TerminalTile.tsx**
```typescript
// Mini xterm.js instance
// FitAddon para llenar el tile
// WebSocket en modo "read-only" (por defecto)
// Click para expandir a full modal
```

**XTerm.tsx**
```typescript
// Full xterm.js con todas las features
// AttachAddon para Socket.io
// FitAddon + WebglAddon (performance)
// SearchAddon (Ctrl+F)
```

### 2.2 Backend (Next.js API Routes)

#### Session Manager (`lib/session-manager.ts`)
```typescript
interface Session {
  id: string;
  name: string;
  type: 'claude' | 'droid' | 'shell';
  workdir: string;
  pty: IPty;           // node-pty instance
  tmuxSession: string; // tmux session name
  socketPath: string;  // tmux socket path
  createdAt: Date;
  metadata: {
    command: string;
    flags: string[];
    pid: number;
  };
}

class SessionManager {
  private sessions: Map<string, Session>;
  
  async create(config: SessionConfig): Promise<Session>;
  async kill(id: string): Promise<void>;
  async resize(id: string, cols: number, rows: number): Promise<void>;
  getAll(): Session[];
  getOutputStream(id: string): ReadableStream;
}
```

#### tmux Wrapper (`lib/tmux.ts`)
```typescript
// Wrapper alrededor de comandos tmux
// Cada sesión tiene su socket aislado para no interferir

const TMUX_SOCKET_DIR = '/tmp/terminal-nexus';

async function createSession(
  name: string,
  workdir: string,
  command: string,
  socketPath: string
): Promise<string> {
  // tmux -S socketPath new-session -d -s name -c workdir command
}

async function capturePane(session: string, socketPath: string): Promise<string> {
  // tmux -S socketPath capture-pane -p -t session
}

async function sendKeys(session: string, keys: string, socketPath: string): Promise<void> {
  // tmux -S socketPath send-keys -t session keys Enter
}
```

#### Socket.io Server (`lib/socket-server.ts`)
```typescript
import { Server } from 'socket.io';

interface ServerToClientEvents {
  'terminal:output': (sessionId: string, data: string) => void;
  'terminal:status': (sessionId: string, status: 'running' | 'stopped') => void;
  'terminal:exited': (sessionId: string, exitCode: number) => void;
}

interface ClientToServerEvents {
  'terminal:join': (sessionId: string) => void;
  'terminal:leave': (sessionId: string) => void;
  'terminal:input': (sessionId: string, data: string) => void;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void;
}

// Rooms: una room por sessionId
// Cuando un cliente se une, le mandamos el historial reciente
// Broadcasting: cuando hay output de un pty, broadcast a la room
```

### 2.3 node-pty Integration

#### Por qué node-pty + tmux (y no solo uno)

| Solo node-pty | Solo tmux | node-pty + tmux |
|--------------|-----------|-----------------|
| Más simple | Persistencia nativa | Mejor de ambos |
| No persiste si proceso muere | API limitada (comandos) | Control + persistencia |
| Resize fácil | Resize via comandos | Resize nativo |
| WebSocket directo | Requiere polling | Streaming directo |

#### Implementación
```typescript
import { spawn } from 'node-pty';

// 1. Crear pty
const pty = spawn('tmux', [
  '-S', socketPath,
  'new-session',
  '-d',  // detached
  '-s', sessionName,
  '-c', workdir,
  command
], {
  name: 'xterm-color',
  cols: 80,
  rows: 24,
  cwd: workdir,
  env: process.env
});

// 2. Pipe pty ↔ WebSocket
pty.onData((data) => {
  io.to(sessionId).emit('terminal:output', sessionId, data);
});

pty.onExit(({ exitCode }) => {
  io.to(sessionId).emit('terminal:exited', sessionId, exitCode);
});

// 3. WebSocket → pty
socket.on('terminal:input', (sessionId, data) => {
  const session = sessionManager.get(sessionId);
  session.pty.write(data);
});

socket.on('terminal:resize', (sessionId, cols, rows) => {
  const session = sessionManager.get(sessionId);
  session.pty.resize(cols, rows);
});
```

---

## 3. Database Strategy (Hybrid)

### 3.1 SQLite (local) - Datos efímeros de sesiones

Para datos que son **locales al VPS** y no necesitan sync:

```sql
-- Sessions activas: metadata temporal
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('claude', 'droid', 'shell')),
  workdir TEXT NOT NULL,
  socket_path TEXT NOT NULL,
  command TEXT NOT NULL,
  flags TEXT,  -- JSON array
  pid INTEGER,
  status TEXT CHECK(status IN ('running', 'stopped', 'error')),
  exit_code INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Logs recientes (rotativo, solo local)
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  data TEXT NOT NULL,  -- base64 encoded
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Convex (cloud) - Estado global y sync

Para datos que necesitan **sync entre devices** y **persistencia**:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Quién está viendo qué terminal
  presence: defineTable({
    userId: v.string(),
    sessionId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("idle")),
    lastSeen: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),

  // Layout del grid (sync entre tabs)
  layouts: defineTable({
    userId: v.string(),
    tiles: v.array(v.object({
      sessionId: v.string(),
      x: v.number(),
      y: v.number(),
      w: v.number(),
      h: v.number(),
    })),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Audit log: quién hizo qué
  auditLogs: defineTable({
    actor: v.union(v.literal("fran"), v.literal("jarvix")),
    action: v.union(
      v.literal("created"),
      v.literal("killed"),
      v.literal("typed"),
      v.literal("resized"),
      v.literal("restarted")
    ),
    sessionId: v.string(),
    metadata: v.optional(v.object({
      command: v.optional(v.string()),
      exitCode: v.optional(v.number()),
      workdir: v.optional(v.string()),
    })),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

  // Templates de sesiones
  templates: defineTable({
    name: v.string(),
    type: v.union(v.literal("claude"), v.literal("droid"), v.literal("shell")),
    workdir: v.optional(v.string()),
    flags: v.optional(v.array(v.string())),
    command: v.optional(v.string()),
    createdBy: v.string(),
    shared: v.boolean(),
  }).index("by_creator", ["createdBy"]),

  // Historial de comandos (para search/autocomplete)
  commandHistory: defineTable({
    sessionId: v.string(),
    command: v.string(),
    output: v.optional(v.string()),
    exitCode: v.optional(v.number()),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

  // Notificaciones
  notifications: defineTable({
    userId: v.string(),
    type: v.union(v.literal("session_ended"), v.literal("error")),
    sessionId: v.string(),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
```

### 3.3 Acceso desde Next.js

```typescript
// SQLite (local)
import { createClient } from '@libsql/client';

export const sqlite = createClient({
  url: 'file:/var/lib/terminal-nexus/data.db',
});

// Convex (cloud sync)
import { ConvexHttpClient } from "convex/browser";

export const convex = new ConvexHttpClient(process.env.CONVEX_URL!);
```

---

## 4. Real-time Strategy

### 4.1 WebSocket Lifecycle

```
Client                          Server
------                          ------
  │                               │
  ├── connect() ─────────────────►│
  │                               │
  │◄──────── connected ───────────┤
  │                               │
  ├── join('session-123') ───────►│──┐
  │                               │  │ add to room
  │◄──────── join:ack ────────────┤◄─┘
  │                               │
  │◄──────── output:data ─────────┤── streaming from pty
  │◄──────── output:data ─────────┤
  │                               │
  ├── input:data ────────────────►│──┐
  │                               │  │ write to pty
  │◄──────── input:ack ───────────┤◄─┘
  │                               │
  ├── leave('session-123') ──────►│──┐
  │                               │  │ remove from room
  │◄──────── leave:ack ───────────┤◄─┘
  │                               │
  ├── disconnect() ──────────────►│── cleanup
```

### 4.2 Reconnection Strategy

```typescript
// Client-side (useSocket.ts)
const socket = io({
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
});

// On reconnect, re-join all rooms
socket.on('connect', () => {
  activeSessions.forEach(id => {
    socket.emit('terminal:join', id);
  });
});
```

### 4.3 Backpressure Handling

Si el cliente va lento (ej: 20 terminales abiertas en una laptop vieja):
1. **Drop mode:** Si el buffer de WebSocket está lleno, dropeamos frames (los terminales tienen scrollback)
2. **Throttle:** Limitar a 30fps de updates
3. **Pause:** Si se desconecta, los datos se acumulan en el pty buffer (tmux lo maneja)

---

## 5. Security

### 5.1 Threat Model

| Threat | Mitigación |
|--------|------------|
| Command injection en workdir | Validar path existe + whitelist de directorios permitidos |
| API abuse | Rate limiting (100 req/min), token auth |
| WS hijacking | Origin validation, JWT en query param |
| Path traversal | Resolver paths con `path.resolve()` + verificar startsWith(allowed) |
| Resource exhaustion | Limitar a 50 sesiones, max 100MB por sesión de logs |

### 5.2 Authentication

Para MVP (single-user):
```typescript
// Simple token en .env
API_TOKEN=dev-token-123

// Middleware
export function authenticate(req: NextRequest) {
  const token = req.headers.get('x-api-key');
  if (token !== process.env.API_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
}
```

Para futuro (multi-user):
- Cloudflare Access (Zero Trust)
- O Auth.js con GitHub OAuth

### 5.3 Path Validation

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
    throw new Error('Invalid workdir: outside allowed paths');
  }
  return resolved;
}
```

---

## 6. Deployment

### 6.1 VPS Setup

```bash
# 1. Dependencies
apt-get install tmux nodejs npm

# 2. Create user
useradd -m terminalnexus
usermod -aG sudo terminalnexus

# 3. Directory structure
mkdir -p /var/lib/terminal-nexus
chown terminalnexus:terminalnexus /var/lib/terminal-nexus

# 4. Build
cd /opt/terminal-nexus
git clone <repo> .
npm install
npm run build

# 5. Environment
cp .env.example .env
# Edit: API_TOKEN, DATABASE_URL, etc.

# 6. Systemd
sudo systemctl enable --now terminal-nexus
```

### 6.2 systemd Service

```ini
# /etc/systemd/system/terminal-nexus.service
[Unit]
Description=Terminal Nexus Dashboard
After=network.target

[Service]
Type=simple
User=terminalnexus
WorkingDirectory=/opt/terminal-nexus
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 6.3 Cloudflare Tunnel

```bash
# cloudflared tunnel create terminal-nexus
# cloudflared tunnel route dns terminal-nexus terminalnexus.tudominio.com

# /etc/cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: terminalnexus.tudominio.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## 7. Performance Optimizations

### 7.1 Frontend
- **React.memo** para TerminalTile (evitar re-renders de todo el grid)
- **Virtual scrolling** si hay >50 sesiones
- **WebGL renderer** en xterm.js para terminales grandes
- **Debounced resize** (esperar 100ms después del drag)

### 7.2 Backend
- **Worker threads:** Cada pty corre en un worker para no bloquear el event loop
- **Compression:** Socket.io con `perMessageDeflate` para payloads grandes
- **Log rotation:** Auto-truncar logs en SQLite > 10MB por sesión

### 7.3 Network
- **Batching:** Agrupar outputs pequeños (< 16 bytes) antes de enviar
- **Binary frames:** WebSocket en modo binario para reducir overhead

---

## 8. Monitoring & Debugging

### 8.1 Logs Estructurados
```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' }
    : undefined,
});

// Uso
logger.info({ sessionId: 'abc', type: 'claude' }, 'Session created');
logger.error({ err, sessionId }, 'Session crashed');
```

### 8.2 Métricas (futuro)
- Número de sesiones activas (gauge)
- Latencia de WebSocket (histogram)
- Errores por minuto (counter)
- Exportar a Prometheus/Grafana

---

## 9. Testing Strategy

### 9.1 Unit Tests (Vitest)
- SessionManager logic
- tmux wrapper commands
- Path validation
- Database queries

### 9.2 Integration Tests (Playwright)
- Crear sesión desde UI
- Enviar input, verificar output
- Reconnect scenario
- Kill y verificar desaparece del grid

### 9.3 E2E Tests
- Script que crea 10 sesiones simultáneas
- Verificar que todas están en el dashboard
- Cargar por 1 hora, verificar memory leaks

---

*Architecture v1.0 — Iterar según aprendamos*
