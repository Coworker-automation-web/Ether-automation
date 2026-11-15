# ETHER: who builds what

Owners are assigned by strength and by risk. One owner per directory; nobody edits another owner's files, they request changes. Sonnet reviews every PR touching roles, auth, rooms, AI or edge routes before merge.

| Short name | Model | Strength used |
|---|---|---|
| Sonnet | Claude Sonnet 5.5 | Security, concurrency, contracts, integration |
| Opus | Antigravity Opus 4.6 | Hard client logic (editor, AI output), live UI checks |
| Flash | Antigravity Flash | Fast, well-specified, low-risk volume work |

## Sonnet
- `packages/shared/*`: roles, permissions, Zod contracts, Yjs doc shape
- `apps/edge/src/index.ts`, `wrangler.jsonc`, `db/schema.ts`
- `apps/edge/src/lib/{session,rbac,crypto}.ts`
- `apps/edge/src/routes/{auth,orgs,ws,workspaces,history,ai}.ts`
- `apps/edge/src/do/{WorkspaceRoom,QuotaGuard}.ts`
- `apps/edge/src/ai/{router.ts,providers/*}`
- `apps/web/src/app/lib/*`: typed Hono client, TanStack Query setup, Yjs provider
- Security and permission-table tests; review gate on all PRs

## Opus
- `apps/web/src/app/features/workspace/editor`: TipTap + Yjs wiring, cursors, viewer read-only
- `apps/web/src/app/features/ai`: SSE consumer, Markdown to editor nodes, AI attribution
- `apps/web/src/app/features/history` logic: restore flow, safety snapshot, editor refresh
- Live checks of the running UI (layout, CSS, accessibility) in the Antigravity browser

## Flash
- `apps/web/src/pages/*`, `src/styles/*`, `public/*`, icon sprite
- `apps/web/src/app/components/*` and the presentational parts of `features/*`: bottom bar, agent menu, settings dialog, tool pills, history panel layout, org switcher, members list, role-key forms, toasts, skeleton / empty / error / daily-limit states
- `apps/edge/src/lib/ids.ts`, `db/migrations/*`, `ai/prompts/*`, seed data
- `apps/edge/test/*` scaffolding and fixtures
- `.github/workflows/*`, Playwright, axe, Lighthouse CI, README and runbooks

## Rules
1. Contracts first: Sonnet publishes `packages/shared` and the RBAC middleware before others build on them.
2. Flash never touches auth, crypto, rooms, AI routing or edge routes.
3. Branch per owner and area; merge by PR after Sonnet review.
