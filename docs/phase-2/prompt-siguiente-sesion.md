# Prompt para Siguiente Sesión - Fase 3: Interactividad Bidireccional

## ⚠️ Actualización (2026-02-18)

Este prompt de Fase 3 quedó **obsoleto** por el Refactor V2.

Usar en su lugar:

- `docs/analysis-extended/prompt-refactor-siguiente-sesion.md`

Y como documento técnico base:

- `docs/analysis-extended/refactor-v2-master-plan.md`

---

Continuar con la Fase 3: Interactividad Bidireccional del Terminal Nexus Dashboard.

Contexto:
- Fase 0 completada: Setup base del monorepo y tooling
- Fase 1 completada: Backend Core (tmux + SessionManager + REST + Socket.io)
- Fase 2 completada: Frontend Core (dashboard, modal, fullscreen, crear sesión, presence/layout/audit base, tests iniciales)
- Detalle técnico de la implementación actual en docs/phase-2/implementation-details.md

Documentación necesaria a consultar:
- TODO.md - Ver tareas de Fase 3 (desde línea 175 en adelante)
- PRD.md - RF-002 (terminal interactiva) y RF-004 (control de sesiones)
- docs/phase-1/implementation-details.md - eventos backend y endpoints
- docs/phase-2/implementation-details.md - decisiones y arquitectura frontend actual

Primeras tareas:
1. Implementar INT-001 a INT-004: input bidireccional robusto (teclas especiales, Ctrl+C/D, arrows)
2. Implementar INT-005 a INT-008: resize completo (observer + persistencia por sesión)
3. Implementar INT-009 a INT-012: UX de terminal (scrollback, copy/paste, search, fullscreen shortcut)
4. Implementar INT-013 a INT-016: control avanzado de sesión (kill/restart/clear con mejor feedback de estado)
5. Implementar INT-017 a INT-019: tests de interacción end-to-end del flujo realtime

Prioridad: Consolidar la experiencia de terminal interactiva completa usando la infraestructura realtime ya construida en Fase 2.

API endpoints disponibles:
- GET /api/sessions - Listar sesiones
- POST /api/sessions - Crear sesión
- DELETE /api/sessions/[id] - Kill sesión
- POST /api/sessions/[id]/restart - Restart sesión
- POST /api/sessions/[id]/resize - Resize sesión
- WebSocket Socket.io en /api/socket-io con eventos: terminal:join, terminal:leave, terminal:input, terminal:resize, terminal:output, terminal:status, terminal:exited

Objetivo: completar la capa de interactividad para que la terminal sea plenamente operable desde el browser con comportamiento estable en tiempo real.
