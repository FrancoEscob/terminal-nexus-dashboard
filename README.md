# 🎛️ Terminal Nexus Dashboard

**Codename:** Terminal Nexus  
**Status:** 📋 Planificación / Documentación  
**Creado:** 2026-02-16  
**Path:** `PROJECTS/terminal-nexus-dashboard/`

---

## 🚨 Actualización V2 (2026-02-18) — Dirección oficial actual

La implementación actual tiene dos problemas críticos no resueltos:

1. **Cerrar/minimizar modal al click afuera** no es confiable.
2. **Sesiones Claude salen `EXITED` al instante** por problemas de lifecycle/runtime.

Por eso el proyecto entra en **Refactor V2** (por etapas, con commits pequeños y validación por stage).

### Documentos canónicos para arrancar el refactor
- Plan maestro: `docs/analysis-extended/refactor-v2-master-plan.md`
- Prompt listo para nueva sesión: `docs/analysis-extended/prompt-refactor-siguiente-sesion.md`

### Nueva visión de producto (V2)
- UX principal: **Flex Grid inline-first** (terminales interactivas dentro del grid).
- Fullscreen/modal: queda como modo opcional de foco.
- Runtime: migración progresiva a **Direct PTY** con adapter de runtime.
- `tmux`: pasa a fallback/compatibilidad, no camino principal para streaming.

### Referencias externas adoptadas (como guía)
- **VibeTunnel:** patrones de runtime PTY, auth/remoto y resiliencia.
- **tmuxwatch:** patrones de wrapper tmux/snapshot/debug.

> Nota: esta sección V2 prevalece sobre descripciones legacy de más abajo.

---

## 🎯 Visión

Un **Super Dashboard** para gestionar, monitorear e interactuar con múltiples sesiones de terminales (Claude Code, Droid, shells, etc.) en tiempo real desde el browser.

No es solo "ver logs" — es tener un **mission control** donde:
- Ves todas las terminales en una **galería tipo masonry/grid**
- Cada terminal es **interactiva** (no solo read-only)
- Podés **crear, destruir, redimensionar** sesiones con clicks
- Vemos **en tiempo real** lo que está haciendo cada agente
- El dashboard escala para futuros módulos (logs, métricas, deploys, etc.)

---

## ✨ Features Core (MVP v1)

### 1. Gallery View (Vista Masonry/Grid)
- Layout tipo "Trello meets tmux"
- Tiles redimensionables (drag corner)
- Preview en vivo de cada terminal
- Indicadores de estado (🟢 activo, 🟡 pausado, 🔴 stopped)
- Badges: tipo de agente (Claude/Droid/Shell), tiempo activo, directorio

### 2. Interactividad Real
- **No es solo streaming de logs** — es la terminal real
- Click en una tile → se expande a modal o sidebar
- Podés escribir comandos directamente desde el browser
- Vemos en tiempo real lo que escribe Jarvix (yo) y la respuesta del agente

### 3. Gestión de Sesiones
- Botón "+ New Session" → modal con options:
  - Tipo: Claude Code / Droid / Shell personalizado
  - Directorio de trabajo
  - Flags (ej: `--yolo`, `--full-auto`)
  - Nombre de sesión (auto o custom)
- Kill / Restart / Pause / Resume desde UI
- Persistencia: las sesiones sobreviven reload del browser

### 4. Real-time Everything
- WebSocket bidireccional para cada terminal
- Cambios reflejan en <100ms
- Reconnect automático si se corta

---

## 🏗️ Arquitectura

### High-Level

```
┌─────────────────────────────────────────────────────────────────┐
│                      BROWSER (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Gallery   │  │   Modal     │  │     Sidebar (mobile)    │  │
│  │   Grid View │  │   Terminal  │  │                         │  │
│  │             │  │   Expanded  │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                 │
│  Tech: Next.js 15 + React 19 + TypeScript + Tailwind + xterm.js │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket (Socket.io / native WS)
                           │ HTTP API (REST)
┌──────────────────────────▼──────────────────────────────────────┐
│                    NODE.JS BACKEND                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │  Socket.io      │  │  REST API       │  │  tmux Manager    │ │
│  │  Server         │  │  (Next API      │  │  (node-pty +     │ │
│  │                 │  │   Routes)       │  │   tmux control)  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘ │
│                                                                 │
│  Tech: Next.js API Routes + Socket.io + node-pty + libtmux      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Unix sockets / pty
┌──────────────────────────▼──────────────────────────────────────┐
│                         tmux SESSIONS                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ claude-1 │ │ droid-1  │ │ shell-1  │ │ claude-2 │            │
│  │ (pty)    │ │ (pty)    │ │ (pty)    │ │ (pty)    │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Por qué esta arquitectura

| Decisión | Alternativa | Por qué elegimos esto |
|----------|-------------|----------------------|
| **Next.js Full-Stack** | FastAPI + Vue separado | Un solo repo, deploy más simple, SSR para SEO si lo necesitamos después |
| **Socket.io** | Native WebSocket | Reconnect automático, rooms para cada terminal, fallback a polling |
| **node-pty** | Solo tmux subprocess | Más control sobre los ptys, podemos hacer attach/detach sin tmux si queremos |
| **tmux + node-pty** | Solo node-pty | tmux da persistencia (sesión sigue si se cae el WS) y permite attach desde SSH también |
| **Tailwind** | CSS-in-JS | Performance, consistency, utility-first para iterar rápido |
| **xterm.js** | Custom canvas | Estándar de la industria (VS Code lo usa), addons para fit, webgl, etc. |

---

## 📁 Estructura de Carpetas

```
terminal-nexus-dashboard/
├── README.md                    # Este archivo
├── PRD.md                       # Product Requirements Document
├── ARCHITECTURE.md              # Deep dive técnico
├── TODO.md                      # Kanban con fases
├── CLOUDFLARE.md                # Config de deploy
│
├── apps/
│   └── web/                     # Next.js 15 app
│       ├── app/                 # App router (Next 15)
│       │   ├── page.tsx         # Dashboard gallery
│       │   ├── layout.tsx       # Root layout con providers
│       │   ├── api/
│       │   │   ├── sessions/
│       │   │   │   ├── route.ts        # GET/POST sessions
│       │   │   │   └── [id]/
│       │   │   │       └── route.ts    # GET/DELETE/PATCH session
│       │   │   └── health/
│       │   │       └── route.ts
│       │   └── terminal/
│       │       └── [id]/
│       │           └── page.tsx        # Full terminal view
│       │
│       ├── components/
│       │   ├── gallery/
│       │   │   ├── TerminalGrid.tsx    # Masonry layout
│       │   │   ├── TerminalTile.tsx    # Individual tile
│       │   │   └── TerminalPreview.tsx # xterm.js mini
│       │   ├── terminal/
│       │   │   ├── XTerm.tsx           # Full xterm component
│       │   │   ├── TerminalToolbar.tsx # Kill, resize, etc.
│       │   │   └── NewSessionModal.tsx
│       │   └── ui/                     # Shadcn/ui components
│       │
│       ├── hooks/
│       │   ├── useSocket.ts            # Socket.io connection
│       │   ├── useTerminal.ts          # xterm.js lifecycle
│       │   └── useSessions.ts          # SWR/fetch sessions
│       │
│       ├── lib/
│       │   ├── socket-server.ts        # Socket.io setup (server)
│       │   ├── tmux.ts                 # tmux wrapper
│       │   └── session-store.ts        # SQLite/mem persistence
│       │
│       ├── types/
│       │   └── index.ts
│       │
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/
│   └── shared/                  # Si necesitamos shared types/utils
│       └── package.json
│
└── infra/
    ├── docker-compose.yml       # Para correr local con tmux
    ├── cloudflare-tunnel.yml    # Config de CF tunnel
    └── systemd/
        └── terminal-nexus.service
```

---

## 🔌 API Spec (High-level)

### REST Endpoints

```typescript
// GET /api/sessions
interface SessionListResponse {
  sessions: {
    id: string;
    name: string;
    type: 'claude' | 'droid' | 'shell';
    status: 'running' | 'stopped' | 'error';
    workdir: string;
    createdAt: string;
    pid?: number;
    socketPath: string;
  }[];
}

// POST /api/sessions
interface CreateSessionRequest {
  type: 'claude' | 'droid' | 'shell';
  workdir: string;
  name?: string;
  flags?: string[];  // ej: ['--yolo']
  command?: string;  // para shell custom
}

// DELETE /api/sessions/:id
// POST /api/sessions/:id/resize { cols: number, rows: number }
// POST /api/sessions/:id/kill
// POST /api/sessions/:id/restart
```

### WebSocket Events (Socket.io)

```typescript
// Client → Server
interface ClientEvents {
  'terminal:join': (sessionId: string) => void;
  'terminal:leave': (sessionId: string) => void;
  'terminal:input': (sessionId: string, data: string) => void;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => void;
}

// Server → Client
interface ServerEvents {
  'terminal:output': (sessionId: string, data: string) => void;
  'terminal:status': (sessionId: string, status: 'running' | 'stopped') => void;
  'session:list': (sessions: Session[]) => void;
}
```

---

## 🚀 Deploy con Cloudflare

Tenemos `cloudflared` instalado. La idea es:

1. Correr el dashboard en `localhost:3000`
2. Cloudflare Tunnel expone `terminalnexus.tudominio.com`
3. Cloudflare Access (opcional) para auth básica

Ver `CLOUDFLARE.md` para el paso a paso.

---

## 🎯 Fases de Desarrollo

Ver `TODO.md` para el Kanban detallado con checkboxes.

**Resumen:**
1. **Fase 0:** Setup y arquitectura base (1-2 días)
2. **Fase 1:** Backend - tmux + WebSocket (2-3 días)
3. **Fase 2:** Frontend - Gallery + xterm.js (2-3 días)
4. **Fase 3:** Interactividad bidireccional (2 días)
5. **Fase 4:** Polish + Deploy (1-2 días)

**Total estimado:** ~8-12 días para MVP usable.

---

## 🔮 Futuro (post-MVP)

- [ ] **Recording/Replay:** Guardar sesiones completas para reproducir después
- [ ] **AI Assistant Panel:** Chat con Jarvix (yo) al lado de cada terminal
- [ ] **File Explorer:** Tree view del filesystem de cada sesión
- [ ] **Multi-server:** Conectar agents en otros VPS, no solo local
- [ ] **Git integration:** Ver branch, commits, PRs en cada sesión
- [ ] **Metrics:** CPU/mem usage por sesión
- [ ] **Collaboration:** Múltiples usuarios viendo la misma terminal (tipo tmate)

---

*Documento vivo — última actualización: 2026-02-16*
