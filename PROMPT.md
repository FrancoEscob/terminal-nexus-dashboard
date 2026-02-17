# Terminal Nexus Dashboard - Prompt para Claude Code

Este archivo contiene los prompts listos para copiar y pegar en Claude Code para cada fase del desarrollo.

---

## 🚀 FASE 0: Setup Inicial (Scaffolding)

```markdown
# Terminal Nexus Dashboard - Fase 0: Setup Inicial

## Contexto
Estoy construyendo un dashboard web para gestionar sesiones de terminales (Claude Code, Droid, etc.) en tiempo real desde el browser. Es un proyecto Next.js 15 full-stack que corre en un VPS.

## Documentación (leer primero)
Los docs están en el repo, leé estos archivos ANTES de empezar:
- `README.md` - Visión general y arquitectura
- `ARCHITECTURE.md` - Deep dive técnico (MUY IMPORTANTE)
- `TODO.md` - Kanban con tareas de esta fase
- `PRD.md` - Requisitos del producto

## Fase 0: Setup y Arquitectura Base
Esta fase es el scaffolding inicial. No es feature code, es tooling y estructura.

### Tareas a completar (del TODO.md):

#### Infra
1. Crear estructura de carpetas (`apps/web`, `packages/shared`)
2. Inicializar monorepo con pnpm workspaces (no Turborepo todavía, mantenlo simple)
3. Setup Next.js 15 con App Router en `apps/web`
4. Configurar TypeScript en strict mode
5. Configurar Tailwind CSS
6. Instalar y configurar Shadcn/ui (init con slate theme)
7. Setup ESLint + Prettier
8. Crear `.env.example` con variables necesarias

#### Database
9. Setup SQLite con Drizzle ORM
10. Crear schema inicial (tabla `sessions` básica)
11. Scripts de migración y seed
12. Setup Convex SDK (instalar `convex` package)
13. Crear `convex/schema.ts` con tablas: presence, layouts, auditLogs, templates

#### Verificación
14. `pnpm install` funciona sin errores
15. `pnpm dev` levanta Next.js en localhost:3000
16. Base de datos SQLite se inicializa correctamente
17. Convex dev server funciona (`npx convex dev`)

## Stack Tecnológico
- Next.js 15 + React 19 + TypeScript
- Tailwind CSS + Shadcn/ui
- Socket.io (instalar pero no configurar todavía)
- node-pty (instalar pero no usar todavía)
- Drizzle ORM + SQLite (libsql)
- Convex (para sync global)
- pnpm (package manager)

## Estructura esperada al final de esta fase:
```
apps/
  web/
    app/                 # Next.js App Router
    components/
    lib/
    convex/             # Schema y functions de Convex
    db/                 # Drizzle schema y migrations
    package.json
packages/
  shared/               # Tipos compartidos (si hace falta)
package.json           # Root workspace
pnpm-workspace.yaml
.env.example
```

## Criterios de éxito (Definition of Done)
- [ ] Puedo correr `pnpm dev` y veo la página de bienvenida de Next.js
- [ ] Puedo correr `npx convex dev` y el dashboard de Convex funciona
- [ ] La estructura de carpetas está organizada como se especifica
- [ ] TypeScript compila sin errores (`pnpm type-check` o similar)
- [ ] No hay código de features todavía, solo scaffolding

## Notas importantes
- NO empieces a codear features de terminal todavía (eso es Fase 1)
- NO instales xterm.js todavía (Fase 2)
- Enfocate en que el tooling funcione bien
- Usa `apps/web` structure (no src/) como prefiere Next.js 15
- Shadcn/ui usa el nuevo CLI: `npx shadcn@latest init`

Cuando termines, hacé un resumen de qué quedó configurado y confirmame que todo funciona antes de pasar a Fase 1.
```

---

## 🔧 FASE 1: Backend Core (Próximamente)

*Prompt pendiente - se creará después de completar Fase 0*

Tareas principales:
- node-pty integration
- tmux wrapper
- Socket.io server
- Session Manager
- API REST endpoints

---

## 🎨 FASE 2: Frontend Core (Próximamente)

*Prompt pendiente - se creará después de completar Fase 1*

Tareas principales:
- xterm.js integration
- TerminalGrid component
- Convex hooks (usePresence, useLayout)
- UI/UX polish

---

## 📋 Cómo usar estos prompts

1. **Abrí Claude Code** en el directorio del proyecto
2. **Copiá el prompt** de la fase correspondiente
3. **Pegalo** en la conversación con Claude Code
4. Claude leerá los docs y empezará a trabajar

### Si Claude se desvía:
Recordale el scope de la fase actual:
- "Esto es Fase 0, solo scaffolding, no features"
- "No toques xterm.js todavía, eso es Fase 2"
- "Focalizate en el setup primero"

---

*Generado: 2026-02-17*
