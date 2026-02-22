# 📋 PRD - Terminal Nexus Dashboard

**Product Requirements Document**  
**Versión:** 1.0  
**Fecha:** 2026-02-16  
**Autor:** Jarvix (con input de Franco)  

---

## 🔄 Addendum PRD V2 (2026-02-18) — Canonical para el refactor

> Esta sección actualiza prioridades y reemplaza la dirección de implementación previa para las fases siguientes.

## A) Problemas críticos a resolver primero

1. **Bug UX:** cerrar/minimizar terminal fullscreen al click afuera del modal no funciona de forma consistente.
2. **Bug runtime:** sesiones de tipo Claude pasan a `EXITED` inmediatamente al crear.

Sin resolver A1/A2 no se considera válido seguir con polish o deploy.

## B) Objetivo de producto V2

Cambiar de modelo **“tile preview + modal obligatorio”** a **“Flex Grid interactivo inline-first”**:

- Todas las terminales operables dentro del grid.
- Resize y drag/reordenamiento del layout en vivo.
- Reflow de tiles vecinas al redimensionar.
- Fullscreen como modo opcional de foco.
- Click afuera en fullscreen/modal = minimizar/cerrar.

## C) Requisitos funcionales V2 (nuevos/actualizados)

### RF-V2-001: Flex Grid interactivo
**Como** usuario, **quiero** una galería flexible y compacta con terminales interactivas **para** operar múltiples sesiones sin abrir modal siempre.

**Criterios:**
- Cada tile permite input/output en tiempo real.
- Resize por tile con handle visual.
- Drag & drop para mover tiles.
- Auto-layout/reflow al cambiar tamaño.
- Persistencia de layout (posición y tamaño).

### RF-V2-002: Fullscreen opcional y confiable
**Como** usuario, **quiero** abrir fullscreen solo cuando necesito foco **para** no depender del modal para operar.

**Criterios:**
- Botón “fullscreen” por tile.
- Click fuera del overlay cierra/minimiza.
- Tecla `Esc` cierra/minimiza.

### RF-V2-003: Runtime robusto para Claude/Droid/Shell
**Como** sistema, **quiero** evitar cierres instantáneos por diseño de runtime **para** no perder sesiones al iniciar.

**Criterios:**
- Runtime principal basado en PTY directo (sin `tmux attach` como path principal).
- Lifecycle explícito (`creating`, `starting`, `running`, `failed`, `exited`).
- Observabilidad de motivo de salida.

### RF-V2-004: Runtime adapter extensible
**Como** equipo, **quiero** desacoplar la capa runtime de la UI/API **para** poder probar backend propio vs externo sin reescribir todo.

**Criterios:**
- Interfaz `TerminalRuntime` única.
- Driver default: `DirectPtyRuntime`.
- Driver fallback: `TmuxRuntime`.
- Driver experimental: `VibeRuntime` (PoC opcional).

### RF-V2-005: Realtime estable
**Como** usuario, **quiero** reconectar sin perder contexto **para** monitorear sesiones largas.

**Criterios:**
- Join/leave robusto con ref-count en cliente.
- Replay de output reciente al reconectar.
- Estado de sesión consistente entre API/WS/DB.

## D) Requisitos no funcionales V2

### RNF-V2-001: Confiabilidad de inicio
- Tasa de fallo de creación Claude < 5% en 20 ejecuciones consecutivas.

### RNF-V2-002: Usabilidad de control
- 100% de tests de interacción para close/minimize del fullscreen en click afuera + `Esc`.

### RNF-V2-003: Performance de grid
- Resize/drag percibido fluido en 10 sesiones activas simultáneas.

## E) Uso de herramientas externas (referencia oficial)

- **VibeTunnel:** referencia para patrones de runtime PTY, auth y acceso remoto.
- **tmuxwatch:** referencia para wrapper tmux y diagnóstico por snapshot.
- **No objetivo en core runtime actual:** `llm-codes`, `wacli`, `homebrew-tap`.

## F) Plan de ejecución y commits

La ejecución queda formalizada en:

- `docs/analysis-extended/refactor-v2-master-plan.md`
- `docs/analysis-extended/prompt-refactor-siguiente-sesion.md`

Con regla obligatoria: **1 commit por tarea significativa/stage**.

---

## 1. Propósito

### 1.1 Problema
Actualmente, gestionar múltiples sesiones de Claude Code en el VPS es:
- **Opaco:** No se ve en tiempo real qué está haciendo cada agente
- **Manual:** Crear sesiones requiere SSH + tmux + comandos manuales
- **No colaborativo:** Fran no puede ver qué hago yo (Jarvix) en las sesiones sin hacer attach

### 1.2 Solución
Un dashboard web donde ambos (humano + IA) podemos:
- Ver todas las terminales en tiempo real
- Crear/matar sesiones desde UI
- Interactuar con cualquier terminal desde el browser
- Tener una "vista de pájaro" de todo el compute del VPS

### 1.3 Éxito (KPIs)
- [ ] Crear una sesión de Claude Code en < 10 segundos
- [ ] Ver output de cualquier terminal con < 100ms de delay
- [ ] Redimensionar una terminal sin perder conexión
- [ ] Correr 10+ sesiones simultáneas sin degradación

---

## 2. Usuarios

### 2.1 Primary: Jarvix (IA / Autonomous Agent)
- **Necesita:** API REST para spawnear sesiones, WebSocket para monitorear
- **Flujo:** Recibo tarea de Fran → spawneo N agents → monitoreo progreso → reporto
- **Pain point:** Ahora tengo que hacer `exec()` y parsear output, no tengo visibilidad continua

### 2.2 Secondary: Franco (Humano / Admin)
- **Necesita:** UI intuitiva, overview rápido, intervención manual
- **Flujo:** Abre dashboard → ve todos los agents → expande uno para ver detalle → interactúa si es necesario
- **Pain point:** Ahora tiene que `ssh + tmux attach` para ver qué hace cada agente

---

## 3. Requisitos Funcionales

### 3.1 RF-001: Gallery View
**Como** usuario, **quiero** ver todas las sesiones en una grilla/masonry **para** tener visión general.

**Criterios:**
- Layout responsive (grid en desktop, lista en mobile)
- Cada tile muestra:
  - Preview en vivo de la terminal (xterm.js)
  - Nombre de sesión
  - Tipo de agente (badge: Claude / Droid / Shell)
  - Estado (indicator LED)
  - Tiempo activo (counter)
  - Directorio de trabajo (path truncado)
- Tiles redimensionables (drag corner)
- Reordenables (drag & drop)

### 3.2 RF-002: Terminal Interactiva
**Como** usuario, **quiero** hacer click en una tile y ver la terminal en tamaño completo **para** interactuar con ella.

**Criterios:**
- Modal o expand inline
- Input funcional (puedo escribir comandos)
- Output en tiempo real (streaming)
- Resize funcional (Ctrl+L equivalente)
- Copy/paste funcional
- Scrollback buffer (últimas 1000 líneas)

### 3.3 RF-003: Crear Sesión
**Como** usuario, **quiero** crear una nueva sesión desde UI **para** no depender de comandos manuales.

**Criterios:**
- Botón flotante "+ New Session"
- Modal con formulario:
  - **Type:** Claude Code / Droid / Custom Shell (radio buttons)
  - **Name:** Auto-generado o custom (ej: "claude-pr-123")
  - **Working Directory:** Input con autocomplete de paths
  - **Flags:** Checkboxes para `--yolo`, `--full-auto` (solo para Claude)
  - **Command:** Solo visible si Type = Shell (ej: `python script.py`)
- Validación: directorio debe existir
- Feedback inmediato: la nueva sesión aparece en gallery

### 3.4 RF-004: Control de Sesiones
**Como** usuario, **quiero** controlar el ciclo de vida de una sesión **para** gestionar recursos.

**Criterios:**
- **Kill:** Mata el proceso (SIGTERM, luego SIGKILL si no responde)
- **Restart:** Kill + recrear con mismos parámetros
- **Pause/Resume:** SIGSTOP / SIGCONT
- **Clear:** Limpia la pantalla (no mata el proceso)
- Confirmación para Kill/Restart (modal "¿Estás seguro?")

### 3.5 RF-005: Persistencia
**Como** sistema, **quiero** que las sesiones sobrevivan al reload del browser **para** que no se pierda trabajo.

**Criterios:**
- Las sesiones corren en tmux (persisten en servidor)
- El dashboard solo "se conecta" a sesiones existentes
- Si recargo el browser, reconecto automáticamente
- Las sesiones aparecen en la lista hasta que se haga Kill explícito

### 3.6 RF-006: API para IA (Jarvix)
**Como** IA, **quiero** una API REST para gestionar sesiones programáticamente **para** orquestar múltiples agents.

**Criterios:**
- Autenticación via token (header `X-API-Key`)
- Endpoints:
  - `POST /api/sessions` → crear
  - `GET /api/sessions` → listar
  - `DELETE /api/sessions/:id` → matar
  - `GET /api/sessions/:id/logs` → historial completo
- Respuestas en JSON con código de error claro
- Rate limiting opcional (no crítico para MVP)

---

## 4. Requisitos No-Funcionales

### 4.1 Performance
- **RNF-001:** Tiempo de carga inicial < 2 segundos en 4G
- **RNF-002:** Latencia WebSocket < 100ms (localhost)
- **RNF-003:** Soportar 20 sesiones visibles simultáneas sin lag
- **RNF-004:** Memory footprint < 200MB para el backend

### 4.2 Seguridad
- **RNF-005:** API protegida con token (no dejar abierta)
- **RNF-006:** WebSocket con origin validation
- **RNF-007:** Sanitización de inputs (evitar command injection)
- **RNF-008:** Restricción de directorios (whitelist de workdirs permitidos)

### 4.3 Usabilidad
- **RNF-009:** Sin tutorial necesario (UI intuitiva)
- **RNF-010:** Dark mode default (terminales se ven mejor)
- **RNF-011:** Keyboard shortcuts (ESC para cerrar modal, Ctrl+K para crear)

### 4.4 Confiabilidad
- **RNF-012:** Reconnect automático si se corta WebSocket
- **RNF-013:** Graceful degradation (si backend cae, mostrar error claro)
- **RNF-014:** Backup de sesiones activas (lista en SQLite)

---

## 5. Tech Stack (Justificación)

### 5.1 Frontend: Next.js 15 + React 19 + TypeScript
| Aspecto | Justificación |
|---------|---------------|
| Next.js 15 | App Router, Server Components para menos JS en cliente, API routes en mismo repo |
| React 19 | Concurrent features, mejor manejo de estado async |
| TypeScript | Type safety para la API contract, refactor seguro |
| Tailwind CSS | Utility-first, rápido de iterar, bundle size optimizado |
| Shadcn/ui | Componentes accesibles, customizable, sin vendor lock-in |

### 5.2 Terminal: xterm.js
- Estándar de la industria (VS Code lo usa)
- Addons disponibles: fit, webgl renderer, ligatures, search
- WebSocket addon listo para usar
- Manejo de encoding correcto (emojis, caracteres especiales)

### 5.3 Backend: Next.js API Routes + Socket.io
| Aspecto | Justificación |
|---------|---------------|
| Same-repo | Un solo deploy, tipos compartidos |
| Socket.io | Reconnect, rooms (una por terminal), fallback a polling |
| node-pty | Crear ptys para cada sesión, bind a tmux |

### 5.4 Procesos: tmux + node-pty
- **tmux:** Persistencia (sesión sigue si el WS se corta)
- **node-pty:** Control preciso sobre los ptys
- **Combinación:** Creamos pty con node-pty → attach a tmux session

### 5.5 Base de Datos: SQLite (libsql/turso opcional)
- Zero-config para VPS
- Suficiente para sessions metadata
- Fácil backup (un archivo)

---

## 6. Edge Cases

### 6.1 Session Crash
- Si el proceso muere (ej: Claude Code crash), el tile muestra 🔴 y un botón "Ver logs"
- Los logs se guardan en SQLite para post-mortem

### 6.2 Network Intermittent
- WebSocket se reconecta automáticamente
- Mientras tanto, el tile muestra "Reconnecting..." con spinner
- No se pierde data porque tmux sigue corriendo

### 6.3 Resize During Command
- Si redimensiono mientras corre un comando largo, el proceso recibe SIGWINCH
- xterm.js re-emite el resize al pty

### 6.4 Multiple Users (Future)
- MVP es single-user (Fran + Jarvix en mismo browser/entorno)
- Para multi-user, agregaríamos "modo broadcast" vs "modo colaborativo"

---

## 7. Open Questions

1. **¿Soportar múltiples VPS?** (V1: no, V2: agent remoto)
2. **¿Limitar recursos por sesión?** (CPU/memory limits)
3. **¿Integrar con GitHub?** (ver PRs asociados a cada sesión)
4. **¿Notificaciones?** (push cuando una sesión termina)
5. **¿Mobile-first o desktop-first?** (decisión: desktop-first, mobile usable)

---

## 8. Anexos

### 8.1 Wireframes (texto)

```
+----------------------------------------------------------+
|  Terminal Nexus                                 [+] New  |
+----------------------------------------------------------+
|                                                          |
|  +----------------+  +----------------+  +-----------+   |
|  | ┌──────────┐   |  | ┌──────────┐   |  | ┌───────┐ |   |
|  | │> Working│   |  | │> Done    │   |  | │> _    │ |   |
|  | │  on...  │   |  | │         │   |  | │       │ |   |
|  | └──────────┘   |  | └──────────┘   |  | └───────┘ |   |
|  | [Claude] 🟢    |  | [Droid]  🔴    |  | [Shell] 🟡|   |
|  | ~/project-1    |  | ~/project-2    |  | ~/tmp     |   |
|  | 00:12:34       |  | 00:45:12       |  | 02:00:00  |   |
|  +----------------+  +----------------+  +-----------+   |
|                                                          |
|  +----------------+  +----------------+                  |
|  | [Empty Slot]   |  | [Empty Slot]   |                  |
|  |   + Create     |  |   + Create     |                  |
|  +----------------+  +----------------+                  |
|                                                          |
+----------------------------------------------------------+
```

### 8.2 User Stories (extras)

**US-001:** "Como Fran, quiero ver un resumen de todas las tareas que están corriendo para decidir en cuál intervenir."

**US-002:** "Como Jarvix, quiero poder spawnear 5 agents simultáneamente y ver el progreso de todos en una grilla."

**US-003:** "Como Fran, quiero poder hacer click en una terminal y escribir un comando si veo que el agente se atascó."

---

*PRD v1.0 — Aprobación pendiente de Franco*
