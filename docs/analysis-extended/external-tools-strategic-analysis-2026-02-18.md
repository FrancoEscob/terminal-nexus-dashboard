# Análisis estratégico extendido: repos externos vs Terminal Nexus

**Fecha:** 2026-02-18  
**Autor:** Droid (sobre base de `docs/analysis/external-libraries-analysis.md`)  
**Objetivo:** decidir si conviene seguir con arquitectura actual o apoyarnos en tooling externo para acelerar estabilidad y roadmap.

---

## 1) Estado real del proyecto hoy (código + docs)

### Fuente revisada
- `TODO.md`, `README.md`, `PRD.md`, `docs/phase-2/prompt-siguiente-sesion.md`
- `apps/web/src/lib/session-manager.ts`
- `apps/web/src/lib/tmux.ts`
- `apps/web/src/lib/socket-server.ts`
- `apps/web/src/lib/socket-client.ts`

### Dónde quedó el último commit
- **HEAD actual:** `00d05ae`  
- **Mensaje:** `fix: avoid premature socket leave with ref-counted joins`  
- **Archivo tocado en ese commit:** `apps/web/src/lib/socket-client.ts`

### Lectura técnica rápida
El último commit mejora estabilidad de **join/leave** de sockets en frontend (evita `leave` prematuro por unmount/mount rápido), pero **no cambia la arquitectura base de procesos PTY/tmux** que hoy concentra el riesgo.

---

## 2) Diagnóstico técnico del bug “CLAUDE sale EXITED al instante”

En `session-manager.ts`, el flujo actual para crear sesión es:

1. `tmux new-session -d ... <command>`
2. luego `node-pty spawn(tmux attach-session -t <name>)`

Eso introduce una topología de doble capa:

`Proceso CLI (claude/droid/shell) -> tmux PTY interno -> pty externo (attach) -> websocket`

### Riesgos concretos de este diseño
- **Dos ciclos de vida acoplados** (tmux session + attach pty) y múltiples puntos de salida.
- El estado “running/stopped/error” en backend depende de `pty.onExit` del `attach`, no solo de la salud del proceso objetivo.
- El mismo patrón se repite en `ensureActiveSession()` y `loadExistingSessions()` (reattach permanente), multiplicando superficies de carrera.

### Conclusión del bug
Tu hipótesis y la del análisis previo es consistente: no es un bug menor de UI; es un problema de diseño de runtime (cómo se encadenan tmux y pty).

---

## 3) Análisis extendido de los 5 repos propuestos

## 3.1 VibeTunnel (`amantus-ai/vibetunnel`) — **Muy alta relevancia**

### Qué aporta (validado en README/metadata)
- Proyecto maduro: ~4k stars, ~276 forks, **51 contributors**.
- Enfoque exacto al problema: browser terminal proxy para agentes.
- Features productizadas que en Nexus están pendientes o inestables:
  - autenticación (system/env/ssh/no-auth)
  - remote access (Tailscale/ngrok/Cloudflare/LAN)
  - session recording (asciinema)
  - git follow mode
  - stack de runtime más probado para I/O terminal.

### Dónde sí hay gap con Nexus
- UX de “mission control” grid de Nexus es diferenciador.
- Nexus ya tiene base de REST API + Convex presence/layout/audit.
- VibeTunnel es fuerte en runtime terminal; Nexus es fuerte en capa producto/orquestación.

### Riesgos de adopción
- Windows no soportado oficialmente aún (issue #252).
- Integración de protocolo/eventos puede requerir adapter.
- Dependencia de roadmap externo si se usa como backend principal.

### Veredicto
**No reemplazar todo ya**, pero sí usar VibeTunnel como referencia principal de runtime o como backend alternativo en PoC.

---

## 3.2 tmuxwatch (`steipete/tmuxwatch`) — **Relevancia media**

### Valor real
- Wrapper tmux limpio y concreto (list/capture/send/kill).
- Patrón robusto de observación por snapshot (`capture-pane`) sin `attach` persistente.
- Herramienta `--dump` útil para debugging estructural de tmux.

### Límite
- Es TUI local, no solución web interactiva completa.

### Veredicto
Muy útil como **inspiración de wrapper + fallback de observabilidad**, no como reemplazo de producto.

---

## 3.3 homebrew-tap (`steipete/homebrew-tap`) — **Relevancia baja**

Sirve para distribución y packaging (futuro), no para resolver bugs de runtime ni interactividad ahora.

---

## 3.4 wacli (`steipete/wacli`) — **No relevante**

Producto sólido, pero dominio distinto (WhatsApp CLI). No resuelve nada central de Terminal Nexus.

---

## 3.5 llm-codes (`amantus-ai/llm-codes`) — **No relevante para core runtime**

Útil para transformar docs JS-heavy a markdown (workflow de investigación/agentes), pero no toca PTY/tmux/sockets.

---

## 4) ¿Estamos haciendo cosas “al pedo”?

## Sí, parcialmente (en backend runtime)
- Reimplementación de capacidades ya maduras en ecosistema (auth/tunnel/recording/terminal runtime).
- Complejidad innecesaria con `tmux detached + attach pty`.

## No (en diferenciador de producto)
- Grid mission-control.
- Presencia/layout/auditoría con Convex.
- Flujo de creación/gestión orientado a tu operación específica de agentes.

---

## 5) Recomendación estratégica (práctica)

## Opción recomendada: **Híbrida incremental**

1. **Corto plazo (estabilidad):**
   - Desacoplar runtime terminal del `attach` persistente.
   - Priorizar PTY directo para `claude`/`droid` (tmux opcional para persistencia, no eje del streaming).

2. **Paralelo (PoC rápido):**
   - Montar un **adapter de backend runtime** (interfaz local) con dos drivers:
     - `NexusRuntime` (actual, mejorado)
     - `VibeRuntime` (PoC contra vibetunnel)
   - Medir estabilidad con escenarios reales (sesiones Claude largas + reconexión + resize).

3. **Decisión por evidencia (no por intuición):**
   - Si VibeRuntime reduce fallos claramente, migrar runtime y conservar frontend/product layer de Nexus.

---

## 6) Plan de validación recomendado (7–10 días)

## Día 1–2: Instrumentación
- Log de lifecycle por sesión: create, first output, attach/disconnect, exit code, duration.
- Métrica: `% sesiones Claude que mueren <60s`.

## Día 3–5: Runtime fix mínimo
- Variante PTY directo para Claude/Droid sin doble attach.
- Mantener tmux solo para casos explícitos de persistencia.

## Día 6–7: PoC VibeRuntime
- Driver básico para crear/adjuntar/cerrar sesión.
- Medir mismas métricas contra runtime propio.

## Día 8–10: Decisión
- Elegir camino por tasa de éxito + complejidad operativa + lock-in.

---

## 7) Matriz de decisión resumida

| Opción | Time-to-fix bug EXITED | Riesgo técnico | Control de producto | Dependencia externa |
|---|---:|---:|---:|---:|
| Seguir igual + parches | Medio | Alto | Alto | Baja |
| Reescribir runtime propio (estilo Vibe) | Medio/Alto | Medio | Muy alto | Baja |
| Híbrido con adapter + PoC Vibe | **Rápido/Medio** | **Medio-bajo** | Alto | Media |
| Pivot total a VibeTunnel | Rápido | Medio | Bajo/Medio | Alta |

**Ganadora recomendada:** Híbrido con adapter + decisión por métricas.

---

## 8) TL;DR ejecutivo

- El último commit mejoró socket join/leave, pero no ataca el problema estructural de runtime PTY/tmux.
- De las librerías externas, **solo VibeTunnel y tmuxwatch aportan valor real inmediato** (runtime y patrones tmux).
- **No están haciendo todo “al pedo”**: el frontend/producto de Nexus sí agrega valor diferencial.
- Donde sí conviene dejar de reinventar es en la capa runtime terminal, empezando por eliminar la doble capa `tmux + attach pty`.
