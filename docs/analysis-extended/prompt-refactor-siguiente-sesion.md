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
   - hacer commit.
3. **No mezclar cambios grandes de distintos stages en un solo commit**.
4. Si algo bloquea un stage, documentar bloqueo y proponer workaround sin frenar todo el avance.

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

Empieza por **Stage 0** inmediatamente.
