# Refactor V2 Master Plan — Terminal Nexus Dashboard

**Fecha:** 2026-02-18  
**Estado:** Plan técnico aprobado para ejecutar en próxima sesión  
**Objetivo:** corregir bugs críticos (modal + `CLAUDE EXITED`) y migrar UX/arquitectura al modelo **Flex Grid interactivo** con runtime estable.

---

## 1) Contexto y diagnóstico (qué falló hasta ahora)

## 1.1 Bugs reportados (prioridad máxima)
1. **Modal no minimiza al click afuera** de forma consistente.
2. **Sesiones Claude salen `EXITED` al instante**.

## 1.2 Evidencia del historial reciente
- Se auditó el historial reciente: muchos commits tocaron `socket-*`, `tmux.ts`, `session-manager.ts`.
- El último commit (`00d05ae`) arregla ref-count de joins/leaves de socket, pero **no resuelve la raíz** del problema Claude.
- La raíz del bug Claude sigue siendo arquitectural: `tmux detached + attach-session` con doble capa de lifecycle.

## 1.3 Conclusión
No es un ajuste menor: hay que hacer **refactor por etapas** de runtime + UX.

---

## 2) Visión V2 (producto)

## 2.1 UX objetivo: “Flex Grid Mission Control”

La experiencia principal deja de ser “tile + abrir modal para trabajar”.

### Comportamiento objetivo
- Cada terminal es **interactiva inline** dentro del grid.
- El dashboard se comporta como **galería flexible**:
  - resize por tile,
  - reordenamiento drag & drop,
  - auto reflow de las demás terminales.
- El modal pasa a ser **opcional** (full screen/focus mode), no obligatorio.
- Click afuera del fullscreen/modal debe **minimizar/cerrar siempre**.

### Criterios UX obligatorios
- Sin fricción para observar múltiples sesiones a la vez.
- Sin dependencia de esquinas/botones redondeados para operar.
- Fullscreen sigue existiendo, pero como acción secundaria explícita.

---

## 3) Arquitectura V2 objetivo (runtime)

## 3.1 Principio rector
Separar explícitamente:
- **orquestación de sesión**,
- **transporte realtime**,
- **persistencia de estado**,
- **layout de UI**.

## 3.2 Runtime Adapter (abstracción obligatoria)

Crear una interfaz única `TerminalRuntime` para desacoplar la app del backend real de PTY.

### Interfaz propuesta
```ts
interface TerminalRuntime {
  createSession(config: SessionCreateConfig): Promise<RuntimeSession>;
  killSession(sessionId: string): Promise<void>;
  resizeSession(sessionId: string, cols: number, rows: number): Promise<void>;
  writeInput(sessionId: string, data: string): Promise<void>;
  getSession(sessionId: string): Promise<RuntimeSession | null>;
  listSessions(): Promise<RuntimeSession[]>;
  subscribe(sessionId: string, handlers: RuntimeHandlers): () => void;
}
```

### Drivers (por etapas)
1. **DirectPtyRuntime (default)**
   - Node-pty directo para `claude`, `droid`, `shell`.
   - Sin `tmux attach` como stream principal.
2. **TmuxRuntime (fallback/legacy)**
   - Mantener para compatibilidad o recuperación puntual.
3. **VibeRuntime (experimental adapter)**
   - Integración opcional/PoC con VibeTunnel para validar estabilidad comparativa.

## 3.3 Session lifecycle explícito

Agregar estado fuerte para evitar “running falso”:
- `creating`
- `starting`
- `running`
- `reconnecting`
- `exited`
- `failed`

El estado no debe depender solo de `attach` exit.

## 3.4 Referencia externa (sin acoplar ciegamente)

### VibeTunnel (referencia principal)
Usar como referencia de:
- runtime PTY robusto,
- auth y remote-access patterns,
- manejo de sesiones y resiliencia.

### tmuxwatch (referencia secundaria)
Usar como referencia de:
- wrapper tmux limpio,
- snapshot/debug (`capture-pane`, `--dump` style),
- fallback de observabilidad sin attach persistente.

### Fuera de scope runtime
- `llm-codes`, `wacli`, `homebrew-tap`.

---

## 4) Cambios de código necesarios (archivo por archivo)

## 4.1 Backend runtime/core

### `apps/web/src/lib/session-manager.ts`
- Extraer lógica actual a un `SessionOrchestrator`.
- Dejar de usar `tmux attach` como stream principal para Claude/Droid.
- Agregar estado de lifecycle explícito.
- Emitir eventos con motivo de cierre (`exitReason`, `exitCode`, `source`).

### `apps/web/src/lib/tmux.ts`
- Mantener wrapper como módulo de fallback/compat.
- Agregar helpers de diagnóstico (`list`, `capture`, verificación de salud).
- Evitar que `tmux` sea dependencia obligatoria del path feliz.

### Nuevo: `apps/web/src/lib/runtime/terminal-runtime.ts`
- Definir interfaz `TerminalRuntime` y tipos comunes.

### Nuevo: `apps/web/src/lib/runtime/direct-pty-runtime.ts`
- Implementar runtime principal V2.

### Nuevo: `apps/web/src/lib/runtime/runtime-factory.ts`
- Selector por env (`TERMINAL_RUNTIME=direct|tmux|vibe`).

### Nuevo (opcional PoC): `apps/web/src/lib/runtime/vibe-runtime.ts`
- Adapter experimental (no necesario para Stage 1 de fix).

## 4.2 Backend API

### `apps/web/src/app/api/sessions/route.ts`
- Crear sesión usando `runtime-factory`.
- Devolver estado inicial más rico (`starting/running`).

### `apps/web/src/app/api/sessions/[id]/route.ts`
- Normalizar GET/DELETE/PATCH con lifecycle V2.
- Evitar check duplicado que anule fallback interno.

### `apps/web/src/app/api/sessions/[id]/restart/route.ts`
- Restart sobre abstracción runtime, no lógica acoplada a tmux.

### `apps/web/src/app/api/sessions/[id]/resize/route.ts`
- Resize vía runtime único.

## 4.3 Realtime

### `apps/web/src/lib/socket-server.ts`
- Suscripción por runtime events en vez de suponer `session.pty` directo.
- Broadcast robusto para reconexión y replay de salida reciente.

### `apps/web/src/lib/socket-client.ts`
- Mantener ref-count join/leave.
- Añadir listeners de lifecycle nuevos (`starting`, `failed`, `exited`).

## 4.4 Frontend UI Flex Grid

### `apps/web/src/components/TerminalGrid.tsx`
- Migrar de grid fijo simple a **flex-grid editable** con layout persistente por tile (x,y,w,h).
- Integrar resize handles y drag consistente.

### `apps/web/src/components/TerminalTile.tsx`
- Terminal inline como componente principal (no preview limitada solamente).
- Acciones rápidas: fullscreen, kill, restart, clear.

### `apps/web/src/components/TerminalModal.tsx`
- Queda como modo fullscreen/focus.
- Click afuera cierra/minimiza siempre.
- Escape cierra.

### `apps/web/src/components/XTerm.tsx`
- Afinar modo inline/fullscreen y resize sync.
- Preservar input/output sin duplicación de listeners.

### `apps/web/src/hooks/use-layout.ts`
- Evolucionar de “orden de IDs” a “layout completo” (coords/sizes).
- Persistencia local + compat con sync remoto futuro.

### `apps/web/src/lib/stores/ui-store.ts`
- Nuevo estado para fullscreen/focus y edición de layout.

## 4.5 Tipos y DB

### `apps/web/src/lib/types.ts` y `apps/web/src/types/session.ts`
- Ampliar `SessionStatus` con estados V2.
- Agregar metadatos de runtime.

### `apps/web/src/lib/db/schema.ts`
- Campo `runtime` (`direct|tmux|vibe`).
- Campo `statusReason` (opcional).

---

## 5) Plan de implementación por etapas (con commits)

> Regla: **1 commit por tarea significativa**.  
> No mezclar runtime + UI + docs en un solo commit gigante.

### Gobernanza obligatoria por stage

Al finalizar **cada stage (0..6)**, además de tests/commit, crear o actualizar:

- `docs/stages/explanations/stage_<N>_explanation.md`

Formato mínimo del archivo de explicación:
1. Contexto y objetivo del stage.
2. Qué había antes (problema/limitación).
3. Qué se cambió (archivo por archivo) y por qué.
4. Cómo se valida (tests/lint/type-check y resultado).
5. Diferencias observables antes vs después.
6. Riesgos pendientes.
7. Ajustes propuestos para stages futuros (si aplica).

Además, mantener trazabilidad de avance en este plan con un estado por stage.

### Estado de avance del plan

| Stage | Estado | Commits | Nota |
|---|---|---|---|
| 0 | ✅ Completado | `446bf5f`, `a85e827` | Cobertura de regresión + logging estructurado |
| 1 | ✅ Completado | `146ca9f`, `89e69b7` | Close por Escape + cobertura de interacciones fullscreen |
| 2 | ⏳ Pendiente | - | Abstracción runtime + factory |
| 3 | ⏳ Pendiente | - | Direct PTY runtime + fix `EXITED` |
| 4 | ⏳ Pendiente | - | Flex-grid inline-first |
| 5 | ⏳ Pendiente | - | Alineación API + integración runtime/realtime |
| 6 | ⏳ Pendiente | - | PoC VibeRuntime (opcional) |

## Stage 0 — Baseline y observabilidad

### Objetivo
Congelar baseline y medir problema real antes de tocar arquitectura.

### Tareas
1. Agregar logs estructurados de lifecycle de sesión.
2. Añadir tests mínimos para modal outside-click y Claude startup contract.

### Commit(s)
- `test: add regression coverage for modal outside-click and session startup lifecycle`
- `chore: add structured runtime lifecycle logging`

---

## Stage 1 — Hotfix UX modal

### Objetivo
Cerrar bug visible de interacción.

### Tareas
1. Asegurar overlay click-close robusto en `TerminalModal`.
2. Añadir `Esc` close.
3. Validar con test de interacción.

### Commit(s)
- `fix(ui): close fullscreen modal on outside click and escape`
- `test(ui): cover fullscreen close interactions`

---

## Stage 2 — Runtime abstraction

### Objetivo
Crear capa `TerminalRuntime` sin romper APIs.

### Tareas
1. Introducir interfaz + factory.
2. Adaptar `session-manager` para usarla.
3. Mantener compat temporal con tmux runtime.

### Commit(s)
- `refactor(runtime): introduce terminal runtime interface and factory`
- `refactor(core): migrate session manager to runtime abstraction`

---

## Stage 3 — Direct PTY runtime (fix Claude EXITED)

### Objetivo
Eliminar dependencia de `tmux attach` para path principal.

### Tareas
1. Implementar `DirectPtyRuntime`.
2. Activarlo por defecto para Claude/Droid.
3. Ajustar estado/session exit reasons.

### Commit(s)
- `feat(runtime): add direct pty runtime for claude droid and shell`
- `fix(runtime): prevent premature exited state by decoupling attach lifecycle`

---

## Stage 4 — Flex Grid V2 (inline-first)

### Objetivo
Migrar UX a grid editable con terminales interactivas inline.

### Tareas
1. Nuevo modelo de layout (x,y,w,h).
2. Drag + resize + auto reflow.
3. Fullscreen como acción secundaria.

### Commit(s)
- `feat(ui): implement flex-grid layout engine with draggable resizable tiles`
- `feat(ui): enable inline interactive terminals and optional fullscreen mode`

---

## Stage 5 — Endpoints, estado y tests E2E

### Objetivo
Consolidar estabilidad funcional.

### Tareas
1. Normalizar rutas API a lifecycle V2.
2. Completar tests de create/input/resize/restart/kill.
3. Verificar reconexión socket + replay output.

### Commit(s)
- `refactor(api): align session endpoints with runtime lifecycle v2`
- `test: add runtime and realtime integration scenarios`

---

## Stage 6 — PoC VibeRuntime (opcional pero recomendado)

### Objetivo
Medir si backend externo reduce incidencia vs runtime propio.

### Tareas
1. Implementar adapter mínimo.
2. Ejecutar benchmark funcional comparativo.
3. Documentar decisión.

### Commit(s)
- `feat(runtime): add experimental vibetunnel adapter`
- `docs(analysis): add comparative runtime benchmark results`

---

## 6) Métricas de aceptación (Definition of Done V2)

## 6.1 Bugs críticos
- Modal cierra/minimiza al click afuera en 100% de casos test.
- Claude no sale `EXITED` prematuramente en smoke test repetido (mínimo 20 ejecuciones).

## 6.2 UX
- Operación normal sin modal obligatorio.
- Resize y drag fluidos con reflow consistente.

## 6.3 Calidad
- `type-check` verde.
- `test` verde.
- lint/documentado según configuración real del repo.

---

## 7) Riesgos y mitigaciones

1. **Complejidad de migración runtime**  
   Mitigación: adapter + feature flag por `TERMINAL_RUNTIME`.

2. **Regresiones de realtime**  
   Mitigación: tests de reconnect/join/leave + replay.

3. **UX flex-grid introduce jank**  
   Mitigación: iterar con throttling de resize, memo y tests visuales.

4. **Lock-in externo si se adopta VibeTunnel directo**  
   Mitigación: mantener interfaz interna como contrato único.

---

## 8) Prompt operativo para nueva sesión

Usar el archivo:

`docs/analysis-extended/prompt-refactor-siguiente-sesion.md`

Ese prompt arranca por Stage 0 y fuerza commits por etapa.

---

## 9) Decisión recomendada

Adoptar **estrategia híbrida incremental**:
- runtime propio V2 (Direct PTY) como default,
- tmux como fallback/compat,
- VibeTunnel como benchmark/adapter opcional,
- UI Flex Grid inline-first.

Esta ruta resuelve tus dos dolores inmediatos y preserva el diferencial del producto.
