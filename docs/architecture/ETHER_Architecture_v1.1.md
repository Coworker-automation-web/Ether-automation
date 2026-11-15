# ETHER — Code Architecture Plan

**Revision:** 1.1  
**Date:** 15 November 2026  
**Status:** Architecture baseline for implementation

## 1. Product direction

ETHER evolves the existing prototype; it is not a redesign. Preserve the current landing page and workspace UI as the visual baseline: layout, hierarchy, colours, typography, spacing, iconography and interaction patterns. Replace mock/local-only behaviour with secure, multi-user functionality.

Deliver the drafting workspace first. Add the spatial canvas (sticky notes, shapes and frames) in phase 4.

### Core user model

- Every signed-in user has a profile and one or more private personal workspaces.
- A user may create an organisation or join one using its active role key.
- Each organisation has one shared **Organisation Public Workspace**. “Public” means visible to current organisation members, not publicly accessible on the internet.
- Personal content stays private unless its owner explicitly publishes selected content to an organisation workspace.
- The organisation workspace is a shared publishing/discovery area. Current members can read published work; permitted roles can publish and edit.
- Organisation membership and workspace access are enforced server-side on every request, download, search, WebSocket connection and file delivery.

## 2. Roles and governance

Roles: **Admin**, **Executive**, **Member**, **Viewer**.

| Capability | Admin | Executive | Member | Viewer |
|---|---:|---:|---:|---:|
| Read organisation Public Workspace | Yes | Yes | Yes | Yes |
| Publish/upload to organisation workspace | Yes | Yes | Yes | No |
| Edit shared organisation content / run AI | Yes | Yes | Yes | No |
| Edit own personal workspace | Owner only | Owner only | Owner only | Owner only |
| Rotate organisation role key | Yes | No | No | No |
| Remove members | Yes | No | No | No |
| Appoint/promote Executive | Yes | No | No | No |
| Transfer Admin to an Executive | Yes | No | No | No |
| Manage organisation AI key | Yes | By explicit delegation | No | No |

Governance invariants:

1. Exactly one active Admin exists per organisation.
2. The role key grants **Member** by default. Possessing the key never grants Admin or Executive.
3. The role key is an invitation secret, not an authentication credential. Joining requires an authenticated ETHER account and a server-side key check.
4. Store only a cryptographic hash of the active role key. Rotation creates a new high-entropy key, displays it once and immediately invalidates the old key. Rate-limit and audit join attempts.
5. Admin transfer is a separate authenticated, atomic and audited operation to an existing Executive. The selected Executive becomes Admin and the previous Admin becomes Executive. If no eligible Executive exists, appoint one first.
6. Removing a member immediately revokes organisation access, including active room/socket access and cached grants. Previously published content remains unless removed under the organisation's retention policy.

## 3. Technology architecture

Use a **pnpm monorepo**.

| Layer | Choice | Responsibility |
|---|---|---|
| Landing site | Astro | Fast public landing and login pages |
| App | React + TypeScript (strict) + Vite + React Router | Workspace UI and client application |
| Styling | Existing CSS variables, CSS Modules | Preserve current design system |
| UI primitives | Radix UI | Accessible dialogs, menus and tabs |
| Rich-text editor | TipTap + Yjs | Collaborative drafting |
| Spatial canvas | react-konva + Yjs (phase 4) | Sticky notes, shapes and frames |
| Server/API | Cloudflare Workers + Hono | Authentication, APIs, AI routing |
| Relational data | Cloudflare D1 + Drizzle | Accounts, organisations, roles and metadata |
| Live collaboration | Durable Objects | One live room per workspace |
| File storage | Private Cloudflare R2 | Uploads and snapshots |
| Shared contracts | Zod package | Shared schemas, roles, permissions and API types |
| Server state | TanStack Query | Fetching and cache |
| Tests | Vitest in workerd, Playwright, axe | Worker, integration, visual and accessibility checks |

### Monorepo layout

```text
ether/
├── apps/
│   ├── web/                 # Astro + React application
│   │   ├── src/pages/       # index.astro, login.astro, app shell
│   │   ├── src/app/         # routes, features, components, lib
│   │   └── src/styles/      # tokens.css, base.css
│   └── edge/                # Cloudflare Worker
│       ├── src/routes/      # auth, orgs, workspaces, history, ai, ws
│       ├── src/do/           # WorkspaceRoom, QuotaGuard
│       ├── src/ai/           # router and provider adapters
│       ├── src/db/           # Drizzle schema and migrations
│       ├── src/lib/          # sessions, RBAC, crypto, IDs
│       └── test/
├── packages/
│   └── shared/              # Zod schemas, permissions, API types
├── .github/workflows/       # CI and deployment
└── pnpm-workspace.yaml
```

### Existing prototype migration

- `index.html` → Astro landing page.
- `workspace.html` → React workspace route; split its inline logic into focused components (editor, history, agent menu, settings and tool controls).
- `styles.css` → design tokens plus component styles; retain existing variables and visual appearance.
- `favicon.svg` → web app public assets.

Before migration, inventory and run the original prototype, capture desktop and mobile screenshots, map every existing screen/control to its destination component and establish visual-regression baselines. Keep the original files in version control during migration.

## 4. Application routes

- `/` — landing page
- `/login` — Google sign-in
- `/app` — profile, personal workspace and organisation switcher
- `/app/personal/:workspaceId` — private personal workspace
- `/app/o/:orgId/public` — organisation Public Workspace
- `/app/o/:orgId/members` — member and role management
- `/app/o/:orgId/settings` — organisation settings and role-key management

The sidebar distinguishes Personal from each joined organisation. Organisation navigation and its Public Workspace are shown only to current members.

## 5. Authentication and security

Use Google's OAuth 2.0 authorization-code flow with PKCE, entirely in the Worker. The browser navigates to `GET /api/auth/google`; the Worker handles state, PKCE verification, callback validation and session creation.

- Use a `__Host-` session cookie with HttpOnly, Secure and SameSite=Lax.
- Store only a hash of the session token in D1; support revocation and expiry.
- Validate Origin on state-changing requests and WebSocket upgrades.
- Derive organisation scope from the caller's authenticated membership, never from an untrusted request body alone.
- Enforce role checks in API middleware and again inside the Durable Object room.
- Use private R2 objects and access-checked Worker streaming or short-lived download URLs. Never expose organisation files through public bucket URLs.
- Encrypt provider keys at rest with AES-GCM using Worker secrets. Never return keys to the browser or log them.
- Keep Google client secrets, encryption secrets and provider keys in Worker secrets, not in source control or Wrangler config.
- Do not render user/AI text with `innerHTML`; convert model output into editor nodes through the editor schema.
- Apply CSP, HSTS, X-Content-Type-Options and frame-ancestors protections.
- Rate-limit authentication, join-key and AI routes. Audit sensitive organisation actions.
- Account deletion removes the user's sessions and memberships; organisation deletion removes its snapshots from R2.

## 6. Data model

| Table | Important columns | Purpose / constraints |
|---|---|---|
| `users` | id, google_sub (unique), email, name, picture, profile fields | One profile per account; Google subject is stable identity |
| `sessions` | token_hash (PK), user_id, expires_at | Hashed, revocable sessions |
| `orgs` | id, name, created_by, admin_user_id, active_role_key_hash, created_at | One active role-key hash and one Admin |
| `memberships` | org_id, user_id, role, joined_at, status | Composite PK (org_id, user_id); membership controls org access |
| `workspaces` | id, scope, owner_user_id, org_id, kind, title, timestamps | Personal scope has owner and no org; organisation scope has org |
| `uploads` | id, workspace_id, uploaded_by, r2_key, filename, content_type, size, visibility | Metadata for private/published files |
| `snapshots` | id, workspace_id, kind, r2_key, bytes, title, summary, summary_status, created_at | Snapshot index in D1; blob in R2 |
| `ai_keys` | org_id, provider, ciphertext, iv, last4 | AES-GCM encrypted provider keys |
| `ai_usage` | day, org_id, user_id, provider, model, requests, tokens_in, tokens_out | Aggregated usage counters |
| `audit_log` | id, org_id, actor_id, action, target, meta, created_at | Role changes, key rotation, joins, removals, publishing and restores |

Enforce workspace-scope constraints in the database and application. Personal workspaces must have an owner and no organisation ID. The organisation Public Workspace belongs to exactly one organisation.

## 7. API surface

| Endpoint | Minimum access | Purpose |
|---|---|---|
| `GET /api/auth/google`, callback | None | Start and finish OAuth |
| `POST /api/auth/logout`, `GET /api/me` | Signed in | End session; return profile and memberships |
| `PATCH /api/profile` | Self | Update profile |
| `POST /api/orgs` | Signed in | Create org, initial Admin and Public Workspace |
| `POST /api/orgs/join` | Signed in | Join with active role key as Member |
| `POST /api/orgs/:id/role-key/rotate` | Admin | Rotate key; return plaintext once |
| `GET /api/orgs/:id/members` | Org member | List members and roles |
| `DELETE /api/orgs/:id/members/:userId` | Admin | Remove member and revoke access |
| `PATCH /api/orgs/:id/members/:userId/role` | Admin | Change permitted non-Admin roles |
| `POST /api/orgs/:id/admin/transfer` | Admin | Atomic Admin transfer to Executive |
| `GET /api/orgs/:id/public-workspace` | Org member | Read shared organisation workspace |
| `POST /api/orgs/:id/public-workspace/uploads` | Member or higher | Publish/upload to org workspace |
| `GET /api/personal/workspaces` | Signed in | List only caller's personal workspaces |
| `GET /api/ws/:workspaceId` | Owner or org member | WebSocket after scope and role checks |
| `GET /api/workspaces/:id/history` | Workspace reader | List accessible snapshots |
| `POST /api/workspaces/:id/history`, restore | Workspace editor | Create named version or restore |
| `POST /api/ai/generate`, summarize | Workspace editor | Generate and attribute AI output |
| `GET/PUT/DELETE /api/orgs/:id/ai-keys`, test | Admin or delegated Executive | Manage and test org provider key |
| `GET /api/ai/usage` | Signed in | Return caller's remaining quota |

Every endpoint must validate the workspace/org relationship and current membership on the server.

## 8. Collaboration and history

The Worker authenticates a request and routes a permitted WebSocket to the corresponding WorkspaceRoom Durable Object. Each room owns its live Yjs document and broadcasts updates to connected collaborators. The room batches persistence writes and writes snapshots to R2, with metadata in D1.

- Personal rooms accept only the owner.
- Organisation rooms accept current members according to role permissions.
- Role changes and member removal invalidate active sockets promptly.
- History is workspace-scoped; restore creates a new snapshot before replacing the active document.
- AI output is inserted as a new block attributed to “AI, requested by <name>”, never silently over the user's text.

## 9. AI routing and quotas

All provider calls run server-side through one AI router. The browser never receives provider secrets.

Suggested routing:
- Generation: Gemini primary; an OpenAI-compatible provider (for example Groq or Cerebras, subject to current terms and availability) as fallback; Workers AI last.
- Summaries: Gemini Flash-Lite primary; Workers AI fallback.
- Web-grounded generation: Gemini with Google Search grounding; disable the option when unavailable rather than silently changing behaviour.

Each request checks the caller's quota in QuotaGuard, uses an organisation-owned key when configured, tries the primary provider, and falls back on retryable 429/5xx failures. Provider cooling periods prevent repeated calls to a failing service. If all routes fail or quota is exhausted, return a structured error and offer the user the option to add an organisation key.

Initial quota values are configuration placeholders, not guaranteed provider allowances: 15 generations and 60 summaries per user per day, and 150 generations per organisation per day. Tune them against observed usage and actual provider limits. Store counters in QuotaGuard Durable Object rather than KV; flush aggregates to D1 periodically.

**Privacy and provider terms:** Google's free-tier content-use and regional terms affect whether it is suitable for a multi-user product. AI must be opt-in with a clear notice. Check the current provider terms and regional restrictions before enabling real user traffic; use a paid organisation key or refuse calls where free-tier use is not permitted. Confirm third-party fallback terms before routing production data to them.

## 10. UX, performance and accessibility

- Preserve the prototype's identity; only change visuals to fix documented usability/accessibility problems or support new account/workspace flows.
- Load the editor and canvas on demand; keep landing and login lightweight.
- Provide designed loading, empty, error and daily-limit states on every route.
- Use reduced-motion preferences and restrained transitions.
- Test mobile overflow, keyboard access, focus management and WCAG AA contrast.
- Run Lighthouse CI, Playwright visual checks and axe accessibility checks in CI.
- Avoid unsafe HTML rendering and self-host required fonts/assets.

## 11. Delivery roadmap and acceptance gates

**Phase 1 — Foundation:** monorepo, shared schemas, CI, Astro/React shell, existing UI migrated without visual regression.

**Phase 2 — Identity and organisations:** Google OAuth, profiles, personal workspaces, organisation creation/join, role keys, membership management and Admin transfer.

**Phase 3 — Collaborative drafting:** Yjs rooms, permissions, snapshots, history, restore and private uploads.

**Phase 4 — Spatial canvas:** Konva canvas objects synchronized through Yjs.

**Phase 5 — AI:** server-side router, provider secrets, quotas, attribution, usage and failure states.

**Phase 6 — Production hardening:** security review, accessibility, load/limit tests, backups, observability, deletion/retention and deployment runbooks.

### First milestone acceptance tests

1. Two Google accounts have distinct profiles and isolated personal workspaces; neither can read the other's private content.
2. A user can create an organisation and becomes its only Admin; the organisation Public Workspace is created automatically.
3. A second authenticated user joins with the current role key and receives Member role; wrong or rotated-out keys are rejected.
4. Current members can read the organisation Public Workspace; non-members cannot read it or access its files, history or sockets.
5. Viewer can read but cannot publish, upload, edit or run AI in the organisation workspace.
6. Admin can rotate the key, remove members and transfer Admin to an existing Executive; old keys and removed-member access stop working immediately.
7. Personal content remains private unless explicitly published.
8. Restore preserves history, and AI output is attributed without overwriting existing user content.

## 12. Operational risks and assumptions

- Free-tier quotas and product terms change; re-check current provider and Cloudflare documentation before launch.
- Durable Object duration/storage and D1 write ceilings must be monitored from real usage. Batch room writes, hibernate idle rooms, and show an explicit daily-limit state instead of a blank screen.
- Keep backups of D1 and R2 data and test restoration.
- Coding-tool free tiers change; keep all implementation work in Git and avoid dependence on a single model or IDE.
- A custom domain may be required for polished Google OAuth branding; verify current Google consent-screen requirements before treating it as a launch blocker.
- The original architecture's specific provider model names and free-tier estimates are planning assumptions, not hard dependencies. Keep providers and quotas configurable.
