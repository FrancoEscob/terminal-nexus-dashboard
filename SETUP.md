# Setup Instructions - Terminal Nexus Dashboard

## ⚠️ Setup V2 (Refactor baseline)

Antes de continuar desarrollo, usar esta base:

1. **Runtime default esperado:** `TERMINAL_RUNTIME=direct` (PTY directo).
2. **tmux queda opcional** para fallback/compat (no path principal).
3. **Validar entorno de comandos** (`claude`, `droid`, shell) antes de crear sesiones.

Variables sugeridas para `.env.local` durante refactor:

```bash
TERMINAL_RUNTIME=direct
TERMINAL_ALLOWED_DIRS=/home/fran/projects,/tmp/experiments,C:\Users\frand\Projects
TERMINAL_OUTPUT_BUFFER_LINES=1000
```

Para ejecutar el plan por etapas:
- Ver: `docs/analysis-extended/refactor-v2-master-plan.md`
- Prompt listo: `docs/analysis-extended/prompt-refactor-siguiente-sesion.md`

---

## Prerequisites

- Node.js 18+ 
- pnpm 8+
- tmux (opcional, solo fallback/debug en V2)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd terminal-nexus-dashboard
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Setup Convex:
```bash
cd apps/web
npx convex dev
```

5. Setup database:
```bash
pnpm --filter web db:push  # Push schema to SQLite
```

## Development

Start the development server:
```bash
pnpm dev
```

This will start:
- Next.js on http://localhost:3000
- Convex functions automatically

## Database Commands

```bash
pnpm db:generate  # Generate migrations
pnpm --filter web db:push  # Push schema to SQLite
pnpm db:studio    # Open Drizzle Studio
```

## Project Structure

```
terminal-nexus-dashboard/
├── apps/web/           # Next.js application
├── packages/shared/    # Shared types and utilities
├── convex/            # Convex functions and schema
└── drizzle/           # Database migrations
```

## Next Steps

After setup, you're ready for Refactor V2 execution:
- Stage 0/1 regression + hotfix modal
- Stage 2/3 runtime abstraction + direct PTY
- Stage 4+ flex-grid and API/realtime hardening
