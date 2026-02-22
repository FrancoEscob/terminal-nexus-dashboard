# Análisis de Librerías Externas vs Terminal Nexus Dashboard

**Fecha:** 2026-02-18  
**Autor:** Cascade (análisis solicitado por Franco)  
**Contexto:** Terminal Nexus Dashboard - Fase 2 completada, Fase 3 pendiente, bugs activos (ej: sesiones Claude mueren al instante)

---

## Resumen Ejecutivo

De las 5 librerías analizadas, **VibeTunnel es la más relevante y potencialmente transformadora** para el proyecto. Es esencialmente lo mismo que estamos construyendo, pero con un nivel de madurez mucho mayor (51 contributors, releases estables, npm package). Las otras librerías van de parcialmente útil (tmuxwatch) a irrelevante (wacli, llm-codes).

**Veredicto rápido:**

| Librería | Relevancia | Acción recomendada |
|----------|-----------|-------------------|
| **VibeTunnel** | 🔴 CRÍTICA | Evaluar seriamente como reemplazo o base del proyecto |
| **tmuxwatch** | 🟡 MEDIA | Estudiar su wrapper tmux como referencia de arquitectura |
| **homebrew-tap** | 🟢 BAJA | Solo útil para distribución futura |
| **wacli** | ⚪ NINGUNA | No aplica al proyecto |
| **llm-codes** | ⚪ NINGUNA | No aplica al proyecto |

---

## 1. VibeTunnel (amantus-ai/vibetunnel)

### Qué es
**"Turn any browser into your terminal; command agents from the road"** — Un servidor Node.js + web frontend que proxea terminales al browser. Soporta múltiples sesiones, monitoreo de agentes IA (Claude Code, ChatGPT), acceso remoto, autenticación, y más.

### Overlap con Terminal Nexus Dashboard

| Feature | Terminal Nexus (nosotros) | VibeTunnel |
|---------|--------------------------|------------|
| Ver terminales en browser | ✅ (xterm.js + Socket.io) | ✅ (ghostty-web + Lit components) |
| Múltiples sesiones simultáneas | ✅ (grid/masonry) | ✅ (tabs + grid) |
| Crear sesiones desde UI | ✅ (modal New Session) | ✅ (comando `vt`) |
| Input bidireccional | 🔴 Fase 3 pendiente + bugs | ✅ Funcional |
| Monitoreo agentes IA | ✅ (Claude/Droid/Shell) | ✅ (cualquier CLI) |
| Persistencia sesiones | ✅ (tmux + SQLite) | ✅ (proceso nativo) |
| Acceso remoto | 🔴 Fase 4 (Cloudflare) | ✅ (Tailscale/ngrok/Cloudflare) |
| Autenticación | 🔴 Pospuesto | ✅ (System/SSH/Password/Token) |
| Session recording | 🔴 Post-MVP | ✅ (asciinema format) |
| Git follow mode | ❌ No planeado | ✅ Funcional |
| Mobile support | ❌ No planeado | ✅ (iOS app + responsive) |
| Activity detection | ❌ No planeado | ✅ (idle/active indicators) |
| Terminal titles | ❌ Parcial | ✅ (3 modos: static/filter/none) |
| npm installable | ❌ | ✅ (`npm install -g vibetunnel`) |

### Qué resuelve que nosotros tenemos buggy

1. **Sesiones que mueren al instante (nuestro bug principal):** VibeTunnel no usa tmux+node-pty como capa intermedia. Usa PTY allocation directa con process management robusto. Nosotros tenemos un problema arquitectural: spawneamos un tmux session, luego spawneamos OTRO pty para hacer `tmux attach` — dos capas de pty que compiten y generan race conditions en el exit handling.

2. **Input bidireccional:** VibeTunnel ya lo tiene resuelto con I/O forwarding transparente. Nosotros aún estamos en Fase 3 con esto pendiente.

3. **Acceso remoto:** VibeTunnel tiene 4 opciones de tunneling listas (Tailscale, ngrok, Cloudflare, LAN). Nosotros planificamos esto para Fase 4.

### Diferencias clave donde Terminal Nexus tiene ventaja (o visión diferente)

1. **Gallery/Masonry view:** Nuestra UI es una grid visual tipo "mission control". VibeTunnel usa tabs + lista más convencional.
2. **Convex integration:** Presence multi-usuario, layout sync en tiempo real, audit logs — esto VibeTunnel no lo tiene.
3. **Customización total:** Al ser nuestro código, podemos adaptar todo. VibeTunnel es más opinionated.
4. **Next.js stack:** Nuestro frontend es Next.js+React+Shadcn. VibeTunnel usa Lit components + ghostty-web.

### Limitaciones de VibeTunnel

- **No soporta Windows** (issue #252 abierto) — nosotros corremos en WSL pero la app está diseñada para Win+WSL.
- **macOS-first:** App nativa Swift para macOS, npm package para Linux. No tiene enfoque server/VPS-first como nosotros.
- **No tiene API REST propia para crear sesiones programáticamente** como la nuestra (POST /api/sessions). Usa el comando `vt` desde terminal.
- **No tiene grid visual** — es más parecido a un tmux multiplexer en browser.

### Opciones estratégicas

**Opción A: Usar VibeTunnel como backend + nuestro frontend encima**
- Instalar VibeTunnel server vía npm en el VPS
- Conectar nuestro Next.js frontend al WebSocket de VibeTunnel
- Mantener nuestra UI (grid, Convex, Shadcn) pero dejar que VibeTunnel maneje toda la capa de PTY/proceso
- **Pro:** Elimina todos nuestros bugs de tmux/pty. Obtenemos session recording, auth, remote access gratis.
- **Contra:** Dependencia de API de terceros. Hay que estudiar si el protocolo WebSocket de VibeTunnel es compatible/documentado.

**Opción B: Estudiar VibeTunnel y aplicar su arquitectura a nuestro código**
- Analizar cómo VibeTunnel maneja PTY allocation sin tmux como capa intermedia
- Reescribir nuestro session-manager.ts con el mismo patrón
- **Pro:** Independencia total, aprendemos, mantenemos control.
- **Contra:** Más trabajo, reinventamos la rueda.

**Opción C: Pivotar completamente a VibeTunnel + fork/extend**
- Forkear VibeTunnel, agregar nuestra grid UI, Convex, etc.
- **Pro:** Base sólida probada por 51 contributors.
- **Contra:** Deuda técnica del fork, stack diferente (Lit vs React), mantenimiento complejo.

**Opción D: Mantener rumbo actual, resolver bugs**
- Seguir con nuestro código, arreglar el bug de doble-pty/tmux.
- **Pro:** Ya tenemos Fase 0-2 hechas.
- **Contra:** Los bugs son arquitecturales, no triviales.

### Recomendación

**Opción B es la más pragmática.** Estudiar VibeTunnel para entender sus patrones de PTY management y aplicarlos a nuestro session-manager. Específicamente:

1. Eliminar la doble capa pty→tmux attach que causa que las sesiones mueran
2. Usar PTY directo como VibeTunnel, con tmux solo como fallback de persistencia
3. Adoptar su patrón de `vt` wrapper para la creación de sesiones si sirve

---

## 2. tmuxwatch (steipete/tmuxwatch)

### Qué es
**"Lightweight TUI to watch tmux sessions"** — Un dashboard TUI (terminal UI) escrito en Go usando Bubble Tea que muestra todas las sesiones tmux en una grilla con live preview via `capture-pane`.

### Overlap con Terminal Nexus

| Feature | Terminal Nexus | tmuxwatch |
|---------|---------------|-----------|
| Ver sesiones tmux | ✅ (web) | ✅ (TUI) |
| Grid/cards layout | ✅ | ✅ |
| Kill sessions | ✅ | ✅ |
| Search/filter | 🔴 Pendiente | ✅ |
| Live output | ✅ (pty streaming) | ✅ (capture-pane polling) |
| Input a sesiones | 🔴 Fase 3 | ❌ Solo read |
| Web access | ✅ | ❌ Solo local TUI |
| Multi-device | ✅ | ❌ |

### Qué podemos aprender

1. **tmux wrapper pattern:** tmuxwatch tiene un wrapper tmux limpio en Go (`internal/tmux/`) que hace snapshot capture, capture-pane, send-keys, kill-session. Es similar a nuestro `tmux.ts` pero más maduro.

2. **Polling vs streaming:** tmuxwatch usa `list-sessions` + `capture-pane` con polling (default 1s). Nosotros usamos pty streaming directo. El approach de polling es más simple y no tiene el bug de "sesiones que mueren" porque nunca hace `tmux attach` — solo lee snapshots.

3. **`--dump` para debugging:** tmuxwatch tiene flag `--dump` que imprime JSON de toda la topología tmux. Esto sería útil para nuestro debugging.

### Relevancia práctica

**MEDIA.** tmuxwatch no reemplaza lo que hacemos (es TUI local, no web), pero su wrapper de tmux y su approach de polling pueden inspirar un fallback más robusto para nuestro preview de sesiones. El patrón de no hacer `tmux attach` (solo read snapshots) es clave para resolver nuestro bug.

---

## 3. homebrew-tap (steipete/homebrew-tap)

### Qué es
Homebrew tap con múltiples herramientas CLI de steipete: tmuxwatch, poltergeist (file watcher), y varias utilidades.

### Relevancia práctica

**BAJA.** Solo útil si queremos distribuir Terminal Nexus como brew formula en el futuro. Contiene las fórmulas para instalar tmuxwatch y VibeTunnel. No aporta nada al desarrollo actual.

### Herramientas interesantes del tap

- **poltergeist:** File watcher universal con auto-rebuild. Podría servir para hot reload en desarrollo, pero ya tenemos Turbopack.
- **codexbar:** Menu bar monitor para Codex y Claude — concepto similar al nuestro pero como cask macOS.

---

## 4. wacli (steipete/wacli)

### Qué es
**"WhatsApp CLI: sync, search, send"** — CLI para WhatsApp basado en whatsmeow (Go).

### Relevancia práctica

**NINGUNA.** No tiene nada que ver con terminal management. Podría ser útil en otro contexto (ej: notificaciones por WhatsApp cuando una sesión termina), pero es extremadamente tangencial y over-engineered para ese caso de uso.

---

## 5. llm-codes (amantus-ai/llm-codes)

### Qué es
**"Transform Developer Documentation for AI Agents"** — Servicio web que convierte documentación JS-heavy a Markdown limpio para que agentes IA puedan leerla.

### Relevancia práctica

**NINGUNA para el proyecto actual.** Es una herramienta de scraping/conversión de docs. No tiene nada que ver con terminal management, sesiones, o PTY. Podría ser útil como herramienta complementaria para los agentes que corren EN las sesiones (que Claude Code pueda leer docs mejor), pero eso es un caso de uso completamente diferente.

---

## Diagnóstico del Bug: Sesiones Claude Mueren al Instante

### Root cause probable

Analizando nuestro `session-manager.ts`, el flujo de creación es:

```
1. tmux new-session -d -s <name> -c <workdir> <command>  ← crea tmux session corriendo "claude"
2. spawn(tmux, ['attach-session', '-t', <name>])         ← crea OTRO pty para attachear
```

El problema: el paso 1 crea una tmux session con el comando `claude` como proceso. Si `claude` no encuentra un TTY interactivo adecuado, o si el proceso de `claude` intenta hacer algo con el terminal que no es compatible con el modo detached de tmux, muere inmediatamente. Luego el paso 2 hace attach a una sesión que ya murió → recibe exit → marca como EXITED.

### Cómo lo resuelve VibeTunnel

VibeTunnel NO usa tmux. Usa PTY allocation directo:
1. Crea un pseudo-terminal (PTY)
2. Spawna el proceso directamente en ese PTY
3. Forwarding de I/O entre PTY ↔ WebSocket ↔ Browser

No hay capa intermedia de tmux que pueda causar problemas.

### Cómo lo resuelve tmuxwatch

tmuxwatch ni siquiera intenta hacer attach. Solo hace:
1. `tmux list-sessions` para ver qué hay
2. `tmux capture-pane` para leer el contenido actual
3. Renderiza en su TUI

Es read-only sobre tmux, no necesita pty intermediario.

### Fix recomendado para nuestro proyecto

**Opción 1 (rápida):** Cambiar a PTY directo sin tmux para la sesión de Claude:
```typescript
// En vez de: tmux new-session + tmux attach
// Hacer: spawn('claude', [...flags], { cwd: workdir })
```
Y usar tmux solo como fallback de persistencia opcional.

**Opción 2 (intermedia):** Mantener tmux pero cambiar a capture-pane polling como tmuxwatch para el preview, sin hacer attach con otro pty.

**Opción 3 (completa):** Adoptar la arquitectura de VibeTunnel — PTY directo + WebSocket forwarding.

---

## Conclusión General

### ¿Estamos haciendo cosas "al pedo"?

**Parcialmente sí:**

1. **La capa tmux+pty doble es innecesaria y es la fuente de bugs.** VibeTunnel demuestra que se puede hacer todo con PTY directo. tmux agrega complejidad sin beneficio real si el dashboard siempre está corriendo.

2. **El tunneling remoto (Fase 4) ya está resuelto por VibeTunnel** con 4 opciones probadas. Reinventarlo sería perder tiempo.

3. **La autenticación (pospuesta) ya está resuelta por VibeTunnel** con 5 modos diferentes.

### ¿Qué NO es "al pedo"?

1. **Nuestra UI de gallery/grid** — VibeTunnel no tiene esta UX de "mission control". Es nuestro diferenciador.
2. **Convex integration** (presence, layout sync, audit) — Unique a nuestro proyecto.
3. **Next.js + React + Shadcn stack** — Más familiar y extensible para nosotros.
4. **API REST para crear sesiones** — VibeTunnel no tiene esto; usa CLI.

### Plan de acción sugerido

1. **Inmediato:** Arreglar el bug de sesiones Claude muriendo → cambiar a PTY directo, sin doble capa tmux.
2. **Corto plazo:** Evaluar usar VibeTunnel server como backend alternativo (instalar via npm, conectar nuestro frontend).
3. **Medio plazo:** Si VibeTunnel funciona como backend, migrar la capa de session management a VibeTunnel y quedarnos solo con el frontend custom.
4. **Mantener:** Nuestra UI grid, Convex, API REST, y todo el frontend.

---

*Documento generado el 2026-02-18 por Cascade a pedido de Franco.*
