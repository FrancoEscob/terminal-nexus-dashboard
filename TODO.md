# 🎯 TODO.md - Terminal Nexus Dashboard

**Kanban de desarrollo**  
**Proyecto:** Terminal Nexus Dashboard  
**Inicio:** 2026-02-16  

---

## 📊 Estado General

| Fase | Estado | Estimado | Real |
|------|--------|----------|------|
| Fase 0: Setup | 🔴 Pendiente | 1-2 días | - |
| Fase 1: Backend Core | 🔴 Pendiente | 2-3 días | - |
| Fase 2: Frontend Core | 🔴 Pendiente | 2-3 días | - |
| Fase 3: Interactividad | 🔴 Pendiente | 2 días | - |
| Fase 4: Deploy | 🔴 Pendiente | 1-2 días | - |
| **Total** | | **8-12 días** | |

---

## 🔴 Fase 0: Setup y Arquitectura Base

**Objetivo:** Estructura inicial del proyecto, tooling configurado.

### Infra
- [ ] **INIT-001:** Crear estructura de carpetas (`apps/web`, `packages/shared`)
- [ ] **INIT-002:** Inicializar monorepo (Turborepo o pnpm workspaces)
- [ ] **INIT-003:** Setup Next.js 15 con App Router
- [ ] **INIT-004:** Configurar TypeScript (strict mode)
- [ ] **INIT-005:** Configurar Tailwind CSS + Shadcn/ui
- [ ] **INIT-006:** Setup ESLint + Prettier
- [ ] **INIT-007:** Crear `.env.example` con todas las variables necesarias

### Database
- [ ] **INIT-008:** Setup SQLite con Drizzle ORM (datos locales)
- [ ] **INIT-009:** Crear migraciones iniciales (schema.sql)
- [ ] **INIT-010:** Setup Convex project + instalar SDK
- [ ] **INIT-011:** Definir schema de Convex (presence, layouts, audit)
- [ ] **INIT-012:** Scripts de seed para development

### Documentación
- [x] **INIT-013:** README.md con overview
- [x] **INIT-014:** PRD.md con requisitos
- [x] **INIT-015:** ARCHITECTURE.md con deep técnico
- [x] **INIT-016:** CLOUDFLARE.md guía deploy

**Definition of Done:**
- `pnpm install` funciona sin errores
- `pnpm dev` levanta Next.js en localhost:3000
- Base de datos se inicializa correctamente
- Todos los docs están en `PROJECTS/terminal-nexus-dashboard/`

---

## 🟠 Fase 1: Backend Core (tmux + WebSocket)

**Objetivo:** API funcional para gestionar sesiones de terminal.

### tmux Integration
- [ ] **BE-001:** Instalar e importar `node-pty`
- [ ] **BE-002:** Crear `lib/tmux.ts` con wrapper de comandos
- [ ] **BE-003:** Función `createSession()` - spawnea pty + tmux
- [ ] **BE-004:** Función `killSession()` - SIGTERM/SIGKILL
- [ ] **BE-005:** Función `resizeSession()` - SIGWINCH
- [ ] **BE-006:** Función `listSessions()` - de tmux y de SQLite
- [ ] **BE-007:** Aislar sockets en `/tmp/terminal-nexus/` para cada sesión

### Session Manager
- [ ] **BE-008:** Crear clase `SessionManager` singleton
- [ ] **BE-009:** Método `create()` - validar path + spawn + persistir en DB
- [ ] **BE-010:** Método `kill()` - limpiar proceso + actualizar DB
- [ ] **BE-011:** Método `get()` - recuperar sesión activa
- [ ] **BE-012:** Método `getAll()` - listar todas las sesiones
- [ ] **BE-013:** Manejo de eventos: onData, onExit, onError

### API REST
- [ ] **BE-014:** `GET /api/sessions` - listar todas
- [ ] **BE-015:** `POST /api/sessions` - crear nueva
- [ ] **BE-016:** `GET /api/sessions/[id]` - detalle de una
- [ ] **BE-017:** `DELETE /api/sessions/[id]` - matar sesión
- [ ] **BE-018:** `POST /api/sessions/[id]/resize` - redimensionar
- [ ] **BE-019:** `POST /api/sessions/[id]/restart` - reiniciar
- [ ] **BE-020:** Middleware de autenticación (API token)

### WebSocket (Socket.io)
- [ ] **BE-021:** Setup Socket.io server en Next.js
- [ ] **BE-022:** Evento `terminal:join` - suscribir a room de sesión
- [ ] **BE-023:** Evento `terminal:leave` - desuscribir
- [ ] **BE-024:** Evento `terminal:input` - escribir al pty
- [ ] **BE-025:** Evento `terminal:resize` - redimensionar pty
- [ ] **BE-026:** Broadcasting: emitir output a todos en la room
- [ ] **BE-027:** Emitir `terminal:status` cuando cambia estado
- [ ] **BE-028:** Emitir `terminal:exited` cuando muere proceso

### Testing
- [ ] **BE-029:** Test: crear sesión vía API
- [ ] **BE-030:** Test: WebSocket recibe output
- [ ] **BE-031:** Test: matar sesión limpia todo

**Definition of Done:**
- Puedo hacer `curl POST /api/sessions` y crea una sesión tmux real
- WebSocket conecta y recibe output en tiempo real
- Las sesiones persisten en SQLite

---

## 🟡 Fase 2: Frontend Core (Gallery + xterm.js)

**Objetivo:** UI funcional para ver y crear terminales.

### Setup UI
- [ ] **FE-001:** Instalar xterm.js + addons (fit, webgl, search)
- [ ] **FE-002:** Instalar Socket.io client
- [ ] **FE-003:** Instalar Convex React client
- [ ] **FE-004:** Configurar Zustand para estado global (UI-only)
- [ ] **FE-005:** Setup SWR para fetching REST API

### Componentes Base
- [ ] **FE-006:** Crear `XTerm.tsx` - componente xterm.js base
- [ ] **FE-007:** Crear `TerminalTile.tsx` - tile individual con preview
- [ ] **FE-008:** Crear `TerminalGrid.tsx` - masonry layout
- [ ] **FE-009:** Crear `TerminalToolbar.tsx` - botones kill, restart, etc.

### Convex Integration
- [ ] **FE-010:** Hook `usePresence()` - quién está viendo cada terminal
- [ ] **FE-011:** Hook `useLayout()` - sync del grid layout
- [ ] **FE-012:** Componente `PresenceIndicator.tsx` - "Fran está viendo esto"
- [ ] **FE-013:** Mutation `updatePresence()` - reportar qué terminal veo
- [ ] **FE-014:** Query `getAuditLogs()` - historial de acciones

### Pages
- [ ] **FE-015:** Dashboard page (`/`) - grid de todas las sesiones
- [ ] **FE-016:** Terminal page (`/terminal/[id]`) - terminal fullscreen
- [ ] **FE-017:** Audit log page (`/logs`) - quién hizo qué

### Features
- [ ] **FE-018:** Fetch inicial de sesiones vía SWR
- [ ] **FE-019:** WebSocket connection singleton
- [ ] **FE-020:** Auto-reconnect de WebSocket
- [ ] **FE-021:** Re-join rooms on reconnect
- [ ] **FE-022:** Preview en mini tiles (fit addon)
- [ ] **FE-023:** Click en tile → expande a modal
- [ ] **FE-024:** Drag & drop para reordenar tiles (sync via Convex)
- [ ] **FE-025:** Persistir layout en Convex
- [ ] **FE-026:** Estado de carga (skeletons)

### Crear Sesión UI
- [ ] **FE-027:** Modal "New Session" con Shadcn
- [ ] **FE-028:** Select: Type (Claude / Droid / Shell)
- [ ] **FE-029:** Input: Name (con auto-generate)
- [ ] **FE-030:** Input: Working Directory (con validación)
- [ ] **FE-031:** Checkboxes: Flags (--yolo, --full-auto)
- [ ] **FE-032:** Submit → POST /api/sessions
- [ ] **FE-033:** Guardar como template (Convex)
- [ ] **FE-034:** Feedback: nueva sesión aparece en grid

### Testing
- [ ] **FE-035:** Test: render grid con sesiones mock
- [ ] **FE-036:** Test: crear sesión desde UI
- [ ] **FE-037:** Test: sync de layout entre tabs

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
- **Dev:** Jarvix (IA) + Claude Code con opus 4.6

---

*Última actualización: 2026-02-16*  
*Estado: Pendiente aprobación de plan por Franco*
