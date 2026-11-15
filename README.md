# ETHER

Collaborative drafting workspace. Architecture: [docs/architecture/ETHER_Architecture_v1.1.md](docs/architecture/ETHER_Architecture_v1.1.md).

## Layout
- `apps/web` – Astro landing/login (React app shell to follow)
- `apps/edge` – Cloudflare Worker (Hono, D1/Drizzle, Durable Objects)
- `packages/shared` – roles, permissions and Zod schemas

## Commands
```
pnpm install
pnpm typecheck
pnpm test
pnpm dev:edge   # http://localhost:8787
pnpm dev:web    # http://localhost:4321
```

## Status
Phase 1 scaffold. Placeholder UI only: the prototype files (`index.html`, `workspace.html`, `styles.css`, `favicon.svg`) are not in this repo yet; add them to start the UI migration.
