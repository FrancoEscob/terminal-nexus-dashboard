# 🎯 TODO.md - Terminal Nexus Dashboard

**Kanban de desarrollo**  
**Proyecto:** Terminal Nexus Dashboard  
**Inicio:** 2026-02-16  

---

## 📊 Estado General

| Fase | Estado | Estimado | Real |
|------|--------|----------|------|
| Fase 0: Setup | ✅ Completada | 1-2 días | 1 día |
| Fase 1: Backend Core | ✅ Completada | 2-3 días | 1 día |
| Fase 2: Frontend Core | ✅ Completada | 2-3 días | 1 día |
| Fase 3: Interactividad | 🔴 Pendiente | 2 días | - |
| Fase 4: Deploy | 🔴 Pendiente | 1-2 días | - |
| **Total** | | **8-12 días** | |

---

## 🔄 Refactor V2 (2026-02-18) — Backlog oficial desde ahora

> Este bloque tiene prioridad sobre fases anteriores para resolver bugs críticos y migrar a la arquitectura/UI nueva.

### Objetivos V2
- [ ] Fix definitivo: click afuera del modal fullscreen debe minimizar/cerrar.
- [ ] Fix definitivo: sesiones Claude no deben salir `EXITED` al instante.
- [ ] Migrar UX a **Flex Grid inline-first**.
- [ ] Introducir **TerminalRuntime adapter** (`direct`, `tmux`, `vibe` experimental).

### Etapas + commits esperados

#### Stage 0 — Baseline y regresiones
- [ ] **V2-000:** Agregar test de regresión modal close outside/escape
- [ ] **V2-001:** Agregar test de smoke para lifecycle de sesión Claude
- [ ] **V2-002:** Instrumentación de logs runtime lifecycle
- [ ] **Commit:** `test: add regression coverage for modal outside-click and session startup lifecycle`
- [ ] **Commit:** `chore: add structured runtime lifecycle logging`

#### Stage 1 — Hotfix modal
- [ ] **V2-010:** Asegurar close por click fuera del fullscreen
- [ ] **V2-011:** Asegurar close por `Esc`
- [ ] **V2-012:** Validar comportamiento en test UI
- [ ] **Commit:** `fix(ui): close fullscreen modal on outside click and escape`
- [ ] **Commit:** `test(ui): cover fullscreen close interactions`

#### Stage 2 — Runtime abstraction
- [ ] **V2-020:** Crear interfaz `TerminalRuntime`
- [ ] **V2-021:** Crear `runtime-factory`
- [ ] **V2-022:** Adaptar `session-manager` a runtime abstraction
- [ ] **Commit:** `refactor(runtime): introduce terminal runtime interface and factory`
- [ ] **Commit:** `refactor(core): migrate session manager to runtime abstraction`

#### Stage 3 — Direct PTY fix Claude EXITED
- [ ] **V2-030:** Implementar `DirectPtyRuntime`
- [ ] **V2-031:** Activar `TERMINAL_RUNTIME=direct` como default
- [ ] **V2-032:** Ajustar estados de lifecycle y motivos de salida
- [ ] **Commit:** `feat(runtime): add direct pty runtime for claude droid and shell`
- [ ] **Commit:** `fix(runtime): prevent premature exited state by decoupling attach lifecycle`

#### Stage 4 — Flex Grid UI
- [ ] **V2-040:** Migrar layout de orden simple a layout geométrico (`x,y,w,h`)
- [ ] **V2-041:** Resize handles y drag & drop con reflow
- [ ] **V2-042:** Terminales interactivas inline (fullscreen opcional)
- [ ] **Commit:** `feat(ui): implement flex-grid layout engine with draggable resizable tiles`
- [ ] **Commit:** `feat(ui): enable inline interactive terminals and optional fullscreen mode`

#### Stage 5 — API + realtime + QA
- [ ] **V2-050:** Normalizar endpoints a lifecycle V2
- [ ] **V2-051:** Validar reconexión/replay output y resize
- [ ] **V2-052:** Tests integración runtime/realtime
- [ ] **Commit:** `refactor(api): align session endpoints with runtime lifecycle v2`
- [ ] **Commit:** `test: add runtime and realtime integration scenarios`

#### Stage 6 — PoC VibeRuntime (opcional recomendado)
- [ ] **V2-060:** Adapter mínimo hacia VibeTunnel
- [ ] **V2-061:** Benchmark comparativo vs runtime propio
- [ ] **Commit:** `feat(runtime): add experimental vibetunnel adapter`
- [ ] **Commit:** `docs(analysis): add comparative runtime benchmark results`

### Definition of Done V2
- [ ] Modal close outside + escape validado por tests.
- [ ] Claude estable en smoke test repetido (mínimo 20 corridas).
- [ ] Grid inline funcional con resize + drag + reflow.
- [ ] Type-check/tests en verde y estado del repo consistente.

---

## ✅ Fase 0: Setup y Arquitectura Base - COMPLETADA

**Objetivo:** Estructura inicial del proyecto, tooling configurado.

### Infra
- [x] **INIT-001:** Crear estructura de carpetas (`apps/web`, `packages/shared`)
- [x] **INIT-002:** Inicializar monorepo (Turborepo o pnpm workspaces)
- [x] **INIT-003:** Setup Next.js 15 con App Router
- [x] **INIT-004:** Configurar TypeScript (strict mode)
- [x] **INIT-005:** Configurar Tailwind CSS + Shadcn/ui
- [x] **INIT-006:** Setup ESLint + Prettier
- [x] **INIT-007:** Crear `.env.example` con todas las variables necesarias

### Database
- [x] **INIT-008:** Setup SQLite con Drizzle ORM (datos locales)
- [x] **INIT-009:** Crear migraciones iniciales (schema.sql)
- [x] **INIT-010:** Setup Convex project + instalar SDK
- [x] **INIT-011:** Definir schema de Convex (presence, layouts, audit)
- [x] **INIT-012:** Scripts de seed para development

### Documentación
- [x] **INIT-013:** README.md con overview
- [x] **INIT-014:** PRD.md con requisitos
- [x] **INIT-015:** ARCHITECTURE.md con deep técnico
- [x] **INIT-016:** CLOUDFLARE.md guía deploy

**✅ Definition of Done:**
- `pnpm install` funciona sin errores
- `pnpm dev` levanta Next.js en localhost:3000
- Base de datos se inicializa correctamente
- Todos los docs están en `PROJECTS/terminal-nexus-dashboard/`

**Actualización:** Actualizado a Next.js 16 con Cache Components y Turbopack

---

## ✅ Fase 1: Backend Core (tmux + WebSocket) - COMPLETADA

**Objetivo:** API funcional para gestionar sesiones de terminal.

### tmux Integration
- [x] **BE-001:** Instalar e importar `node-pty`
- [x] **BE-002:** Crear `lib/tmux.ts` con wrapper de comandos
- [x] **BE-003:** Función `createSession()` - spawnea pty + tmux
- [x] **BE-004:** Función `killSession()` - SIGTERM/SIGKILL
- [x] **BE-005:** Función `resizeSession()` - SIGWINCH
- [x] **BE-006:** Función `listSessions()` - de tmux y de SQLite
- [x] **BE-007:** Aislar sockets en `/tmp/terminal-nexus/` para cada sesión

### Session Manager
- [x] **BE-008:** Crear clase `SessionManager` singleton
- [x] **BE-009:** Método `create()` - validar path + spawn + persistir en DB
- [x] **BE-010:** Método `kill()` - limpiar proceso + actualizar DB
- [x] **BE-011:** Método `get()` - recuperar sesión activa
- [x] **BE-012:** Método `getAll()` - listar todas las sesiones
- [x] **BE-013:** Manejo de eventos: onData, onExit, onError

### API REST
- [x] **BE-014:** `GET /api/sessions` - listar todas
- [x] **BE-015:** `POST /api/sessions` - crear nueva
- [x] **BE-016:** `GET /api/sessions/[id]` - detalle de una
- [x] **BE-017:** `DELETE /api/sessions/[id]` - matar sesión
- [x] **BE-018:** `POST /api/sessions/[id]/resize` - redimensionar
- [x] **BE-019:** `POST /api/sessions/[id]/restart` - reiniciar
- [ ] **BE-020:** Middleware de autenticación (API token) *Pospuesto para MVP*

### WebSocket (Socket.io)
- [x] **BE-021:** Setup Socket.io server en Next.js
- [x] **BE-022:** Evento `terminal:join` - suscribir a room de sesión
- [x] **BE-023:** Evento `terminal:leave` - desuscribir
- [x] **BE-024:** Evento `terminal:input` - escribir al pty
- [x] **BE-025:** Evento `terminal:resize` - redimensionar pty
- [x] **BE-026:** Broadcasting: emitir output a todos en la room
- [x] **BE-027:** Emitir `terminal:status` cuando cambia estado
- [x] **BE-028:** Emitir `terminal:exited` cuando muere proceso

### Testing
- [x] **BE-029:** Test: crear sesión vía API
- [x] **BE-030:** Test: WebSocket recibe output
- [x] **BE-031:** Test: matar sesión limpia todo

**✅ Definition of Done:**
- [x] Puedo hacer `curl POST /api/sessions` y crea una sesión tmux real
- [x] WebSocket conecta y recibe output en tiempo real
- [x] Las sesiones persisten en SQLite

**Actualización:** Fase 1 completada exitosamente. Ver `docs/phase-1/implementation-details.md` para documentación detallada.

---

## ✅ Fase 2: Frontend Core (Gallery + xterm.js)

**Objetivo:** UI funcional para ver y crear terminales.

### Setup UI
- [x] **FE-001:** Instalar xterm.js + addons (fit, webgl, search)
- [x] **FE-002:** Instalar Socket.io client
- [x] **FE-003:** Instalar Convex React client
- [x] **FE-004:** Configurar Zustand para estado global (UI-only)
- [x] **FE-005:** Setup SWR para fetching REST API

### Componentes Base
- [x] **FE-006:** Crear `XTerm.tsx` - componente xterm.js base
- [x] **FE-007:** Crear `TerminalTile.tsx` - tile individual con preview
- [x] **FE-008:** Crear `TerminalGrid.tsx` - masonry layout
- [x] **FE-009:** Crear `TerminalToolbar.tsx` - botones kill, restart, etc.

### Convex Integration
- [x] **FE-010:** Hook `usePresence()` - quién está viendo cada terminal
- [x] **FE-011:** Hook `useLayout()` - sync del grid layout
- [x] **FE-012:** Componente `PresenceIndicator.tsx` - "Fran está viendo esto"
- [x] **FE-013:** Mutation `updatePresence()` - reportar qué terminal veo
- [x] **FE-014:** Query `getAuditLogs()` - historial de acciones

### Pages
- [x] **FE-015:** Dashboard page (`/`) - grid de todas las sesiones
- [x] **FE-016:** Terminal page (`/terminal/[id]`) - terminal fullscreen
- [x] **FE-017:** Audit log page (`/logs`) - quién hizo qué

### Features
- [x] **FE-018:** Fetch inicial de sesiones vía SWR
- [x] **FE-019:** WebSocket connection singleton
- [x] **FE-020:** Auto-reconnect de WebSocket
- [x] **FE-021:** Re-join rooms on reconnect
- [x] **FE-022:** Preview en mini tiles (fit addon)
- [x] **FE-023:** Click en tile → expande a modal
- [x] **FE-024:** Drag & drop para reordenar tiles (sync via Convex)
- [x] **FE-025:** Persistir layout en Convex
- [x] **FE-026:** Estado de carga (skeletons)

### Crear Sesión UI
- [x] **FE-027:** Modal "New Session" con Shadcn
- [x] **FE-028:** Select: Type (Claude / Droid / Shell)
- [x] **FE-029:** Input: Name (con auto-generate)
- [x] **FE-030:** Input: Working Directory (con validación)
- [x] **FE-031:** Checkboxes: Flags (--yolo, --full-auto)
- [x] **FE-032:** Submit → POST /api/sessions
- [x] **FE-033:** Guardar como template (Convex)
- [x] **FE-034:** Feedback: nueva sesión aparece en grid

### Testing
- [x] **FE-035:** Test: render grid con sesiones mock
- [x] **FE-036:** Test: crear sesión desde UI
- [x] **FE-037:** Test: sync de layout entre tabs

**Definition of Done:**
- Abro el dashboard y veo las sesiones existentes
- Puedo crear una nueva sesión desde el botón "+"
- Cada tile muestra preview en vivo del output
- Click expande a modal con terminal funcional

---

## 🟢 Fase 3: Interactividad Bidireccional

**Objetivo:** Poder escribir en las terminales desde el browser.

### Input Handling
- [ ] **INT-001:** Capturar keystrokes en xterm.js
- [ ] **INT-002:** Enviar `terminal:input` vía WebSocket
- [ ] **INT-003:** Feedback visual: cursor parpadea
- [ ] **INT-004:** Soporte para special keys (Ctrl+C, Ctrl+D, arrows)

### Resize
- [ ] **INT-005:** Resize observer en tiles
- [ ] **INT-006:** Enviar `terminal:resize` vía WebSocket
- [ ] **INT-007:** Drag corner para resize manual de tiles
- [ ] **INT-008:** Persistir tamaño preferido por sesión

### Mejoras UX
- [ ] **INT-009:** Scrollback buffer (cargar historia reciente al unirse)
- [ ] **INT-010:** Copy/paste funcional
- [ ] **INT-011:** Search dentro de terminal (Ctrl+F)
- [ ] **INT-012:** Fullscreen mode (F11)

### Control de Sesiones
- [ ] **INT-013:** Botón Kill con confirmación
- [ ] **INT-014:** Botón Restart (kill + recrear)
- [ ] **INT-015:** Botón Clear (enviar `clear` o Ctrl+L)
- [ ] **INT-016:** Indicadores de estado animados

### Testing
- [ ] **INT-017:** Test: escribir comando y ver respuesta
- [ ] **INT-018:** Test: resize mientras corre comando
- [ ] **INT-019:** Test: kill session desde UI

**Definition of Done:**
- Puedo escribir comandos en cualquier terminal desde el browser
- Resize funciona y el proceso lo detecta (ej: `htop` se ajusta)
- Kill/Restart funcionan sin errores

---

## 🔵 Fase 4: Deploy y Producción

**Objetivo:** Dashboard funcionando en el VPS con dominio propio.

### Optimizaciones
- [ ] **DEP-001:** Build de producción (`next build`)
- [ ] **DEP-002:** Analizar bundle size
- [ ] **DEP-003:** Optimizar imports de xterm.js (lazy load)
- [ ] **DEP-004:** Configurar CDN para assets estáticos (opcional)

### VPS Setup
- [ ] **DEP-005:** Crear usuario `terminalnexus`
- [ ] **DEP-006:** Setup directorios (`/opt/terminal-nexus`, `/var/lib/terminal-nexus`)
- [ ] **DEP-007:** Instalar dependencias del sistema (tmux, nodejs)
- [ ] **DEP-008:** Clone repo + install + build

### Producción
- [ ] **DEP-009:** Crear `.env.production`
- [ ] **DEP-010:** Setup systemd service
- [ ] **DEP-011:** Configurar logs (pino → file)
- [ ] **DEP-012:** Health check endpoint
- [ ] **DEP-013:** Start service

### Cloudflare
- [ ] **DEP-014:** Configurar Cloudflare Tunnel
- [ ] **DEP-015:** Configurar dominio `terminalnexus.tudominio.com`
- [ ] **DEP-016:** Setup Cloudflare Access (opcional, auth básica)
- [ ] **DEP-017:** HTTPS automático

### Monitoreo
- [ ] **DEP-018:** Logs rotativos (logrotate)
- [ ] **DEP-019:** Alerta si service cae (systemd notification)
- [ ] **DEP-020:** Health check periódico

### Testing
- [ ] **DEP-021:** Test: acceder desde dominio público
- [ ] **DEP-022:** Test: crear sesión desde afuera del VPS
- [ ] **DEP-023:** Test: múltiples usuarios simultáneos (Fran + Jarvix)
- [ ] **DEP-024:** Load test: 20 sesiones simultáneas

**Definition of Done:**
- Accedo a `https://terminalnexus.tudominio.com` y funciona
- Puedo crear, usar y matar sesiones desde cualquier lugar
- Las sesiones sobreviven reinicios del service
- Logs están rotando correctamente

---

## 🚀 Post-MVP (Futuro)

### Features Adicionales
- [ ] **FUT-001:** Recording/Replay de sesiones completas
- [ ] **FUT-002:** File explorer (tree view del filesystem)
- [ ] **FUT-003:** Git integration (branch, commits, diffs)
- [ ] **FUT-004:** Multi-server (conectar agents en otros VPS)
- [ ] **FUT-005:** Notificaciones (push cuando termina sesión)
- [ ] **FUT-006:** Templates guardados (configs reutilizables)
- [ ] **FUT-007:** Collaborative mode (múltiples usuarios en misma terminal)
- [ ] **FUT-008:** AI Assistant panel (chat con Jarvix al lado de terminal)
- [ ] **FUT-009:** Metrics dashboard (CPU/mem por sesión)
- [ ] **FUT-010:** Search global (buscar en todas las terminales)

### Convex Features
- [ ] **FUT-016:** Notificaciones push cross-device (Convex + web push)
- [ ] **FUT-017:** Search global de comandos (Convex full-text search)
- [ ] **FUT-018:** Analytics de uso (Convex aggregations)
- [ ] **FUT-019:** Multi-user permissions (Convex auth)

---

## 📝 Notas de Desarrollo

### Convenciones
- **Branch naming:** `feat/FE-123-nombre-corto`, `fix/BE-456-bug-desc`
- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **PRs:** Siempre con descripción y screenshots si hay UI

### Recursos
- **xterm.js docs:** https://xtermjs.org/docs/
- **Socket.io:** https://socket.io/docs/v4/
- **node-pty:** https://github.com/microsoft/node-pty
- **tmux:** https://github.com/tmux/tmux/wiki

### Contactos
- **Owner:** Franco (Fran)
- **Dev:** Jarvix (IA) + Claude Code con Opus 4.5

---

## 🎯 Próximos Pasos - Fase 1

### Orden Recomendado:
1. **tmux wrapper** (`lib/tmux.ts`) - Base para todo
2. **Session Manager** - Clase singleton para gestionar sesiones
3. **API REST** - Endpoints básicos (CRUD de sesiones)
4. **Socket.io server** - Streaming en tiempo real
5. **Testing** - Asegurar que todo funciona junto

### Prompt para Próxima Sesión:
```
Continuar con la Fase 1: Backend Core del Terminal Nexus Dashboard.

Contexto:
- Fase 0 completada: Next.js 16, SQLite, Convex configurados
- Estructura de monorepo lista
- Base de datos con schema de sesiones creado

Primeras tareas:
1. Instalar node-pty para manejar pseudoterminals
2. Crear wrapper de tmux en lib/tmux.ts
3. Implementar SessionManager class
4. Crear API endpoints para gestión de sesiones
5. Configurar Socket.io para streaming en tiempo real

Prioridad: Empezar con node-pty y el wrapper de tmux, ya que es la base para toda la funcionalidad de terminales.
```

---

*Última actualización: 2026-02-17*  
*Estado: Fase 2 completada ✅, listo para Fase 3*
