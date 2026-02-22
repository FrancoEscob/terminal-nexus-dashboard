# Stage 1 — Hotfix UX modal fullscreen (explicación didáctica)

## 1) Contexto y objetivo

El objetivo de Stage 1 fue cerrar el bug visible de interacción en fullscreen:

- cerrar al click afuera,
- cerrar con `Escape`.

Esto apunta a una UX más confiable en el flujo diario, sin esperar al refactor runtime de stages siguientes.

## 2) Qué había antes

Antes de Stage 1:

1. El modal ya tenía cierre por backdrop en click, pero no tenía cierre por teclado (`Escape`).
2. La cobertura de tests de interacción fullscreen no incluía teclado.

## 3) Qué se cambió y por qué

### A) Fix UI

#### `apps/web/src/components/TerminalModal.tsx`

Se agregó un `useEffect` que escucha `keydown` cuando el modal está montado:

- si la tecla es `Escape`, ejecuta `onClose()`.

**Por qué:** `Escape` es comportamiento esperado de modales y reduce fricción/clicks extra.

### B) Cobertura de tests

#### `apps/web/src/components/__tests__/TerminalModal.test.tsx`

Se añadieron dos casos:

1. cierra al presionar `Escape`,
2. no cierra con otra tecla (`Enter`).

**Por qué:** evita regresiones de accesibilidad/interacción por teclado.

## 4) Validación ejecutada

Se ejecutó en `apps/web`:

1. `pnpm --filter web test -- src/components/__tests__/TerminalModal.test.tsx`
2. `pnpm --filter web lint`
3. `pnpm --filter web type-check`

Resultado:

- tests: OK,
- lint: OK sin errores (quedan warnings legacy),
- type-check: OK.

## 5) Diferencia antes vs después

### Antes

- fullscreen dependía principalmente del click en backdrop o botón de cerrar.
- no había garantía por tests para cierre por teclado.

### Después

- fullscreen también cierra con `Escape`.
- hay pruebas explícitas para interacción por mouse + teclado.

## 6) Riesgos pendientes

1. El bug de `CLAUDE EXITED` sigue abierto hasta Stage 2/3 (arquitectural runtime).
2. Persisten warnings de lint legacy fuera del scope de este stage.

## 7) Ajustes propuestos para stages futuros

1. Stage 2: al introducir `TerminalRuntime`, mantener eventos de lifecycle compatibles con el logger estructurado de Stage 0.
2. Stage 2/3: agregar pruebas de integración para transiciones `starting -> running -> exited/failed` para evitar “running falso”.
3. Stage 3: medir con smoke repetitivo (>=20 runs) la mejora real del bug `EXITED` prematuro en sesiones Claude.
