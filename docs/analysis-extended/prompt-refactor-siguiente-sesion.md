# Prompt para próxima sesión — Refactor V2 Terminal Nexus

Quiero que ejecutes el **Refactor V2** de Terminal Nexus Dashboard por etapas, siguiendo estrictamente el plan en:

`docs/analysis-extended/refactor-v2-master-plan.md`

## Contexto clave
- El bug de modal (click afuera no minimiza/cierra) es prioridad crítica.
- El bug de Claude `EXITED` al instante es prioridad crítica.
- La UX objetivo es **Flex Grid inline-first** (terminales interactivas en la grilla; fullscreen opcional).

## Reglas de ejecución
1. Trabajar por **stages** (0 → 6) en orden.
2. En cada stage:
   - implementar,
   - correr validadores aplicables,
   - dejar notas breves de resultado,
   - crear/actualizar `docs/stages/explanations/stage_<N>_explanation.md` en formato didáctico,
   - hacer commit.
3. **No mezclar cambios grandes de distintos stages en un solo commit**.
4. Si algo bloquea un stage, documentar bloqueo y proponer workaround sin frenar todo el avance.
5. Al cerrar cada stage, proponer ajustes dinámicos para stages futuros si aparecen hallazgos nuevos.
6. Actualizar en `docs/analysis-extended/refactor-v2-master-plan.md` la tabla de estado de avance del stage ejecutado.

## Commits esperados (base)
- `test: add regression coverage for modal outside-click and session startup lifecycle`
- `chore: add structured runtime lifecycle logging`
- `fix(ui): close fullscreen modal on outside click and escape`
- `test(ui): cover fullscreen close interactions`
- `refactor(runtime): introduce terminal runtime interface and factory`
- `refactor(core): migrate session manager to runtime abstraction`
- `feat(runtime): add direct pty runtime for claude droid and shell`
- `fix(runtime): prevent premature exited state by decoupling attach lifecycle`
- `feat(ui): implement flex-grid layout engine with draggable resizable tiles`
- `feat(ui): enable inline interactive terminals and optional fullscreen mode`
- `refactor(api): align session endpoints with runtime lifecycle v2`
- `test: add runtime and realtime integration scenarios`

## Entregable mínimo por stage
- Qué cambiaste (archivos)
- Qué validaste
- Riesgos pendientes
- Commit hash
- Link/ruta del archivo de explicación didáctica del stage
- Propuesta de ajustes para próximos stages (si aplica)

Empieza por el **próximo stage pendiente** según la tabla de avance del plan maestro.
