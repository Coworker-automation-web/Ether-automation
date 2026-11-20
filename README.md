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
Phase 1. The landing page is migrated from the prototype (`prototype/` is kept as the visual baseline).

Web styling lives in `apps/web/src/styles/` (`tokens.css`, `fonts.css`, `base.css`) and one CSS Module per component in `apps/web/src/app/components/`. Fonts are self-hosted via `@fontsource-variable` (latin subset). Icons come from the `public/icons.svg` sprite through `<Icon name="…" />`.
