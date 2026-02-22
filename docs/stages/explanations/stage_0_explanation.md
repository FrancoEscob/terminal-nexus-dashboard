# Stage 0 — Baseline y observabilidad (explicación didáctica)

## 1) Contexto y objetivo

Stage 0 no busca “arreglar todo”, sino preparar terreno seguro para los fixes grandes:

- tener regresión automática para bugs críticos,
- tener observabilidad clara del lifecycle runtime.

Sin esto, Stage 1+ se vuelve frágil porque no sabemos si una mejora rompe otra cosa.

## 2) Qué había antes

Antes de Stage 0:

1. El modal tenía cobertura básica de click-outside, pero faltaba un caso de interacción realista (interacción interna + luego backdrop).
2. No existía una prueba dedicada al contrato de startup lifecycle de sesión para detectar salidas tempranas del flujo de arranque.
3. El backend tenía logs dispersos (`console.log/error`) y sin estructura homogénea para correlacionar eventos API + socket + session-manager.

## 3) Qué se cambió y por qué

### A) Tests de regresión

#### `apps/web/src/components/__tests__/TerminalModal.test.tsx`

Se añadió el caso:

- interactuar dentro del modal,
- luego click en backdrop,
- verificar que igual cierra.

**Por qué:** captura un patrón de uso real donde a veces los handlers quedan mal encadenados.

#### `apps/web/src/lib/__tests__/session-startup-lifecycle.test.ts` (nuevo)

Se creó un test de contrato de arranque con mocks controlados de:

- `node-pty`,
- `child_process`,
- `db`,
- `TmuxWrapper`.

Valida dos puntos:

1. al crear sesión, queda en estado `running` inicial esperado,
2. si el PTY sale con código 0, se actualiza estado a `stopped` y se persiste `exitCode`.

**Por qué:** protege lifecycle mínimo antes de introducir la abstracción runtime de Stage 2/3.

### B) Logging estructurado de lifecycle

#### `apps/web/src/lib/runtime-lifecycle-logger.ts` (nuevo)

Se centralizó un logger con payload uniforme:

- `event`, `sessionId`, `sessionType`, `runtime`, `status`, `exitCode`, `source`, `reason`, `timestamp`.

#### Instrumentación en backend/API

Archivos tocados:

- `apps/web/src/lib/session-manager.ts`
- `apps/web/src/lib/socket-server.ts`
- `apps/web/src/app/api/sessions/route.ts`
- `apps/web/src/app/api/sessions/[id]/route.ts`
- `apps/web/src/app/api/sessions/[id]/restart/route.ts`
- `apps/web/src/app/api/sessions/[id]/resize/route.ts`

**Por qué:** ahora se puede reconstruir el flujo completo de una sesión desde request inicial hasta salida/reconexión.

## 4) Validación ejecutada

Se ejecutó en `apps/web`:

1. tests target de Stage 0,
2. lint,
3. type-check.

Resultado:

- tests: OK,
- lint: OK sin errores (quedan warnings legacy),
- type-check: OK.

## 5) Diferencia antes vs después

### Antes

- Menor protección ante regresiones en lifecycle de arranque.
- Baja trazabilidad para entender por qué una sesión terminaba o fallaba.

### Después

- Hay red de seguridad de tests para modal y startup lifecycle.
- Hay telemetría estructurada para correlacionar eventos críticos de sesión.

## 6) Riesgos pendientes

1. La causa raíz de `CLAUDE EXITED` todavía depende del refactor runtime (Stage 2/3).
2. El volumen de logs puede crecer en sesiones intensivas; se puede graduar por nivel/env en stages siguientes.

## 7) Ajustes propuestos para stages futuros

1. En Stage 1, agregar tests de `Escape` y confirmar close por overlay con foco en accesibilidad.
2. En Stage 2, mantener el logger actual pero mapear `runtime` dinámicamente (`direct|tmux|vibe`) desde la factory.
3. En Stage 3, agregar smoke repetitivo de creación Claude para medir reducción real de `EXITED` prematuro.
