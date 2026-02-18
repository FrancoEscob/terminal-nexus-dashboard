# Setup Instructions - Terminal Nexus Dashboard

## Prerequisites

- Node.js 18+ 
- pnpm 8+
- tmux (for Phase 1)

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
pnpm db:push  # Push schema to SQLite
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
pnpm db:push      # Push schema to database
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

After setup, you're ready for Phase 1 development:
- tmux integration
- WebSocket server
- REST API endpoints
