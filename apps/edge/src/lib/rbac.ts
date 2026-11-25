import { type Action, can, type Role, type RoomRole } from "@ether/shared";
import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { createDb, type Db } from "../db";
import { memberships, workspaces } from "../db/schema";
import type { Env } from "../env";
import { errorResponse } from "./http";
import { clearSessionCookie, lookupSession, readSessionToken, sessionCookie } from "./session";

export interface WorkspaceRef {
  id: string;
  scope: "personal" | "organisation";
  ownerUserId: string | null;
  orgId: string | null;
}

export interface AppVariables {
  userId: string;
  orgId: string;
  role: Role | null;
  aiKeyDelegated: boolean;
  workspace: WorkspaceRef;
  roomRole: RoomRole;
}
export type AppEnv = { Bindings: Env; Variables: AppVariables };

// ---------------------------------------------------------------------------
// Data access. The role ALWAYS comes from the caller's active membership row.
// ---------------------------------------------------------------------------

export async function getMembership(db: Db, orgId: string, userId: string) {
  return db
    .select({ role: memberships.role, aiKeyDelegated: memberships.aiKeyDelegated })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId), eq(memberships.status, "active")))
    .get();
}

/** One round trip: the workspace and, for organisation workspaces, the caller's active membership. */
export async function loadWorkspaceAccess(db: Db, workspaceId: string, userId: string) {
  return db
    .select({
      id: workspaces.id,
      scope: workspaces.scope,
      ownerUserId: workspaces.ownerUserId,
      orgId: workspaces.orgId,
      role: memberships.role,
      aiKeyDelegated: memberships.aiKeyDelegated,
    })
    .from(workspaces)
    .leftJoin(
      memberships,
      and(eq(memberships.orgId, workspaces.orgId), eq(memberships.userId, userId), eq(memberships.status, "active")),
    )
    .where(eq(workspaces.id, workspaceId))
    .get();
}

// ---------------------------------------------------------------------------
// Middleware. Compose as: app.get(path, requireSession, requireOrgRole("members.list"), handler)
// Unknown or inaccessible resources answer 404 (no existence oracle); an active member whose
// role is too low gets 403.
// ---------------------------------------------------------------------------

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = readSessionToken(c.req.header("cookie"));
  if (!token) return errorResponse(c, "unauthenticated", "Sign in required");

  const session = await lookupSession(createDb(c.env.DB), token);
  if (!session) {
    c.header("Set-Cookie", clearSessionCookie());
    return errorResponse(c, "unauthenticated", "Sign in required");
  }
  c.set("userId", session.userId);
  if (session.refreshed) c.header("Set-Cookie", sessionCookie(token));
  await next();
};

/** Org scope comes from the :orgId path segment checked against the caller's membership, never from a body. */
export function requireOrgRole(action: Action): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const userId = c.get("userId");
    if (!userId) return errorResponse(c, "unauthenticated", "Sign in required"); // fails closed if requireSession is missing
    const orgId = c.req.param("orgId");
    if (!orgId) throw new Error(`requireOrgRole(${action}) used on a route without :orgId`);

    const m = await getMembership(createDb(c.env.DB), orgId, userId);
    if (!m) return errorResponse(c, "not_found", "Not found");
    if (!can(m.role, action, { aiKeyDelegated: m.aiKeyDelegated })) {
      return errorResponse(c, "forbidden", "You do not have permission to do that");
    }
    c.set("orgId", orgId);
    c.set("role", m.role);
    c.set("aiKeyDelegated", m.aiKeyDelegated);
    await next();
  };
}

/**
 * Resolves workspace -> owner/org on the server. `source: "body"` reads `workspaceId` from the JSON
 * body (Hono caches the parsed body, so the handler can read it again). The client-supplied id is
 * only a lookup key: access always derives from the workspace row and the caller's membership.
 */
export function requireWorkspaceAccess(
  action: Action,
  opts: { source?: "param" | "body" } = {},
): MiddlewareHandler<AppEnv> {
  const source = opts.source ?? "param";
  return async (c, next) => {
    const userId = c.get("userId");
    if (!userId) return errorResponse(c, "unauthenticated", "Sign in required");

    let workspaceId: unknown;
    if (source === "param") {
      workspaceId = c.req.param("workspaceId");
    } else {
      const body: unknown = await c.req.json().catch(() => null);
      workspaceId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).workspaceId : undefined;
    }
    if (typeof workspaceId !== "string" || workspaceId.length === 0 || workspaceId.length > 64) {
      return errorResponse(c, "validation", "workspaceId is required");
    }

    const row = await loadWorkspaceAccess(createDb(c.env.DB), workspaceId, userId);
    if (!row) return errorResponse(c, "not_found", "Not found");

    const ref: WorkspaceRef = { id: row.id, scope: row.scope, ownerUserId: row.ownerUserId, orgId: row.orgId };

    if (row.scope === "personal") {
      const isOwner = row.ownerUserId === userId;
      if (!can(null, action, { signedIn: true, workspaceScope: "personal", isOwner })) {
        return errorResponse(c, "not_found", "Not found"); // someone else's personal workspace does not exist for you
      }
      c.set("role", null);
      c.set("roomRole", "owner");
    } else {
      if (!row.role) return errorResponse(c, "not_found", "Not found"); // not an active member of that org
      if (!can(row.role, action, { workspaceScope: "organisation", aiKeyDelegated: row.aiKeyDelegated ?? false })) {
        return errorResponse(c, "forbidden", "You do not have permission to do that");
      }
      c.set("role", row.role);
      c.set("roomRole", row.role);
      c.set("aiKeyDelegated", row.aiKeyDelegated ?? false);
      if (row.orgId) c.set("orgId", row.orgId);
    }
    c.set("workspace", ref);
    await next();
  };
}
