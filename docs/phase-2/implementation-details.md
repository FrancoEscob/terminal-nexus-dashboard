# Phase 2: Frontend Core - Implementation Details

## Overview

Esta etapa quedó completada end-to-end: además de la base de galería realtime, ahora incluye modal expandida, página fullscreen por sesión, toolbar de control (kill/restart/clear), flujo de creación de sesiones desde UI, hooks de presence/layout/audit para sincronización de estado colaborativo, y tests iniciales de frontend.

---

## 1. Qué se implementó en esta etapa

### 1.1 Setup de dependencias (FE-001, FE-002, FE-004, FE-005)
Se instalaron las dependencias clave del frontend:

- `xterm`
- `@xterm/addon-fit`
- `@xterm/addon-webgl`
- `@xterm/addon-search`
- `socket.io-client`
- `zustand`
- `swr`

**Por qué:**
- `xterm` renderiza terminal real en navegador.
- Addons habilitan ajuste dinámico (`fit`), performance (`webgl`) y búsqueda (`search`).
- `socket.io-client` permite streaming bidireccional robusto con reconexión automática.
- `zustand` simplifica estado global UI-only sin boilerplate.
- `swr` estandariza fetch de sesiones y revalidación.

---

### 1.2 Dashboard funcional en `/` (FE-015 + FE-018)
La página principal dejó de ser placeholder y ahora:
- Hace fetch de sesiones con SWR (`GET /api/sessions`)
- Muestra contador de sesiones activas
- Renderiza grilla responsive de tiles
- Maneja estados de loading, error y empty

**Archivo clave:** `apps/web/src/app/page.tsx`

---

### 1.3 Hook de datos tipado (FE-018)
Se creó `useSessions()`:
- Fetch tipado de `/api/sessions`
- Validación de respuesta `{ success, data }`
- Refresh periódico y revalidate on focus
- Orden de sesiones por `createdAt` descendente

**Archivo clave:** `apps/web/src/hooks/use-sessions.ts`

---

### 1.4 Tipos frontend de sesión
Se agregó contrato explícito para frontend:
- `SessionSummary`
- `SessionStatus`
- `ApiResponse<T>`

**Archivo clave:** `apps/web/src/types/session.ts`

**Por qué es crítico:**
Evita acoplar el frontend a tipos backend que incluyen detalles de servidor (por ejemplo `pty`) y permite mantener una boundary clara entre API serializable y estado interno del backend.

---

### 1.5 Estado global con Zustand (FE-004)
Se implementó store UI-only con:
- `selectedSessionId`
- `isTerminalModalOpen`
- `subscribedSessionIds`
- acciones de selección/apertura/cierre/suscripción

**Archivo clave:** `apps/web/src/lib/stores/ui-store.ts`

**Por qué:**
El estado visual/UX no debería depender de socket internamente. Esta separación facilita testeo, debugging y evolución hacia modal/fullscreen sin refactor grande.

---

### 1.6 Cliente Socket singleton + reconexión (FE-019, FE-020, FE-021)
Se creó un cliente singleton que:
- Inicializa una sola conexión Socket.io
- Reintenta reconectar (`reconnection: true`)
- Re-join automático de rooms tras reconnect
- Expone helpers: `joinSession`, `leaveSession`, `sendTerminalInput`, `sendTerminalResize`
- Centraliza listeners de `terminal:output` y `terminal:status`

**Archivo clave:** `apps/web/src/lib/socket-client.ts`

**Decisión clave:**
No abrir una conexión por tile. Se usa **un socket compartido** para reducir consumo de recursos y evitar comportamientos no deterministas en reconexiones.

---

### 1.7 Componentes base de terminal

#### `XTerm.tsx` (FE-006)
Responsabilidades:
- Crear instancia de `Terminal`
- Cargar addons fit/search/webgl
- Suscribirse a output de una sesión
- Enviar input al backend cuando `readOnly=false`
- Join/leave de room por `sessionId`
- Cleanup robusto en unmount

**Archivo:** `apps/web/src/components/XTerm.tsx`

#### `TerminalTile.tsx` (FE-007 + FE-022)
Responsabilidades:
- Mostrar metadata de sesión (nombre, tipo, workdir, status, uptime)
- Renderizar preview terminal read-only
- Escuchar cambios de estado en vivo (`terminal:status`)
- Permitir selección por click/teclado

**Archivo:** `apps/web/src/components/TerminalTile.tsx`

#### `TerminalGrid.tsx` (FE-008 + FE-026)
Responsabilidades:
- Render de colección de tiles
- Skeleton loading
- Empty state
- Error state
- Layout responsive tipo masonry-like con CSS Grid
- Entrada `+ New Session`
- Apertura de modal de terminal
- Reordenamiento drag & drop con persistencia

**Archivo:** `apps/web/src/components/TerminalGrid.tsx`

### 1.8 Modal expandida + toolbar de control (FE-009, FE-023)
Se agregaron:
- `TerminalModal.tsx` para vista expandida de una sesión desde la galería.
- `TerminalToolbar.tsx` con acciones de control:
  - **Clear** (Ctrl+L vía `terminal:input`)
  - **Restart** (`POST /api/sessions/[id]/restart`)
  - **Kill** (`DELETE /api/sessions/[id]`)
  - Acceso rápido a fullscreen.

Cada acción crítica escribe audit log en frontend (base para trazabilidad).

### 1.9 Flujo de creación de sesión en UI (FE-027 a FE-034)
Se implementó `NewSessionModal.tsx` con:
- selector de tipo (Claude / Droid / Shell)
- nombre auto-generado o custom
- validación básica de workdir absoluta
- flags `--yolo` y `--full-auto` para Claude
- command opcional para Shell
- persistencia de templates
- submit a `POST /api/sessions`
- refresh de grid para feedback inmediato

### 1.10 Página fullscreen por sesión (FE-016)
Se implementó ruta `app/terminal/[id]` + `TerminalFullscreenView`:
- renderiza `XTerm` en modo interactivo full viewport
- sincroniza resize con backend
- reusa toolbar de control
- muestra presencia en tiempo real

### 1.11 Página de logs (FE-017)
Se implementó ruta `app/logs`:
- listado de auditoría con timestamp
- detalle de metadata por evento
- navegación de vuelta al dashboard

### 1.12 Hooks de colaboración y estado compartido (FE-010 a FE-014, FE-024, FE-025)
Se incorporaron hooks/fundaciones para colaboración:
- `usePresence` + `usePresenceTracker`
- `PresenceIndicator`
- `useLayout` (persistencia/sync cross-tab de orden de tiles)
- `useAuditLogs` + `appendAuditLog`
- funciones Convex en `convex/presence.ts`, `convex/layout.ts`, `convex/audit.ts`

Nota: se dejó estrategia híbrida con fallback local para mantener funcionamiento sin requerir despliegue Convex activo durante desarrollo local.

### 1.13 Testing frontend (FE-035 a FE-037)
Se configuró Vitest + Testing Library y se agregaron pruebas iniciales:
- `TerminalGrid.test.tsx` (render grid con sesiones mock)
- `NewSessionModal.test.tsx` (crear sesión desde UI)
- `use-layout.test.tsx` (sync de layout entre tabs/storage)

---

## 2. Integración con backend existente

### REST
- Frontend consume `GET /api/sessions` para estado inicial.
- Fuente: `app/api/sessions/route.ts` (Fase 1).

### WebSocket / Socket.io
- Eventos usados desde cliente:
  - `terminal:join`
  - `terminal:leave`
  - `terminal:input`
  - `terminal:resize`
- Eventos recibidos:
  - `terminal:output`
  - `terminal:status`

### Cambio importante de ruta Socket
Durante la implementación se detectó incompatibilidad al intentar montar Socket.io directamente en App Router route handler (`app/api/socket/route.ts`) con firma de Pages API.

Se resolvió así:
- Transporte Socket.io real en **Pages API**: `src/pages/api/socket-io.ts`
- Ruta App Router `app/api/socket` queda como endpoint informativo/status
- Cliente y server socket alineados a `path: '/api/socket-io'`

**Por qué es crítico:**
Evita errores de build y respeta la forma válida de inicializar Socket.io con acceso a `res.socket.server`.

---

## 3. Problemas críticos encontrados y cómo se resolvieron

### 3.1 Error de build por `route.ts` no válido para socket
**Síntoma:** `Type ... has no properties in common with RouteHandlerConfig` y warning de `config` deprecated en App Router.

**Causa raíz:** Se estaba usando patrón de Pages API (`NextApiRequest/NextApiResponse`) dentro de App Router `route.ts`.

**Fix:** mover transporte real a `pages/api/socket-io.ts` y dejar `app/api/socket/route.ts` como endpoint simple.

---

### 3.2 Error SSR `ReferenceError: self is not defined` con xterm
**Síntoma:** build falla al prerender `/` cuando importa `xterm`.

**Causa raíz:** `xterm` evalúa código que depende de `self` en contexto browser.

**Fix aplicado en `XTerm.tsx`:**
- Lazy import dinámico de `xterm` y addons dentro de `useEffect`.
- Evita evaluación en SSR.

**Aprendizaje:**
Con librerías browser-heavy, no alcanza con `'use client'`; puede requerirse import dinámico para impedir evaluación durante build/prerender.

---

## 4. Flujo de datos actual (end-to-end)

1. `Home` monta y llama `useSessions()`.
2. SWR pide `/api/sessions` y obtiene lista inicial.
3. `TerminalGrid` renderiza `TerminalTile` por sesión.
4. Cada tile monta `XTerm` read-only.
5. `XTerm` hace `joinSession(sessionId)` y escucha output.
6. Backend emite `terminal:output` desde `sessionManager`/pty.
7. Cliente escribe bytes en xterm (`terminal.write(data)`).
8. Si hay reconnect, socket singleton vuelve a unir rooms automáticamente.

---

## 5. Archivos creados/modificados en esta etapa

### Nuevos
- `apps/web/src/types/session.ts`
- `apps/web/src/types/convex.ts`
- `apps/web/src/hooks/use-sessions.ts`
- `apps/web/src/hooks/use-session.ts`
- `apps/web/src/hooks/use-layout.ts`
- `apps/web/src/hooks/use-presence.ts`
- `apps/web/src/hooks/use-audit-logs.ts`
- `apps/web/src/hooks/use-create-session.ts`
- `apps/web/src/hooks/use-session-actions.ts`
- `apps/web/src/hooks/use-session-templates.ts`
- `apps/web/src/lib/stores/ui-store.ts`
- `apps/web/src/lib/socket-client.ts`
- `apps/web/src/lib/client-id.ts`
- `apps/web/src/components/XTerm.tsx`
- `apps/web/src/components/TerminalTile.tsx`
- `apps/web/src/components/TerminalGrid.tsx`
- `apps/web/src/components/TerminalToolbar.tsx`
- `apps/web/src/components/TerminalModal.tsx`
- `apps/web/src/components/NewSessionModal.tsx`
- `apps/web/src/components/PresenceIndicator.tsx`
- `apps/web/src/components/TerminalFullscreenView.tsx`
- `apps/web/src/components/AppPresenceTracker.tsx`
- `apps/web/src/components/ConvexClientProvider.tsx`
- `apps/web/src/app/logs/page.tsx`
- `apps/web/src/app/terminal/[id]/page.tsx`
- `apps/web/src/components/__tests__/TerminalGrid.test.tsx`
- `apps/web/src/components/__tests__/NewSessionModal.test.tsx`
- `apps/web/src/hooks/__tests__/use-layout.test.tsx`
- `apps/web/src/test/setup.ts`
- `apps/web/vitest.config.ts`
- `apps/web/src/pages/api/socket-io.ts`
- `apps/web/convex/presence.ts`
- `apps/web/convex/layout.ts`
- `apps/web/convex/audit.ts`

### Modificados
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/lib/socket-server.ts`
- `apps/web/src/app/api/socket/route.ts`
- `apps/web/next.config.js`
- `apps/web/package.json`
- `.gitignore`

---

## 6. Validación ejecutada

- `pnpm --filter web type-check` ✅
- `pnpm --filter web test` ✅
- `pnpm --filter web build` ✅

Nota:
- `pnpm --filter web lint` falla por script existente de proyecto (`next lint` invocado como directorio inválido), no por errores de TypeScript de esta etapa.

---

## 7. Cierre de Fase 2

La Fase 2 quedó completada contra el checklist de `TODO.md` (FE-001 a FE-037).

Estado final:
- Dashboard de sesiones realtime operativo
- Modal expandida y fullscreen por sesión
- Control de sesión desde UI (kill/restart/clear)
- Creación de sesiones desde UI con templates
- Presencia/layout/audit con base colaborativa
- Suite inicial de tests frontend pasando

---

## 8. Recomendaciones para Fase 3

1. Mantener `XTerm` reutilizable en dos modos:
   - preview (read-only, tile)
   - full (interactive, modal/page)
2. Endurecer input bidireccional para teclas especiales y combinaciones complejas.
3. Incorporar E2E del flujo realtime (input→output, resize, kill/restart) en CI.
4. Mantener conexión socket singleton (no por componente).
5. Profundizar Convex para multi-dispositivo real cuando se habilite deployment de backend Convex.

---

## 9. Resumen

Fase 2 pasó de foundation a producto usable: ya se puede visualizar, abrir, controlar y crear terminales desde el browser en tiempo real, con estructura técnica sólida para avanzar a la Fase 3 de interactividad avanzada.
