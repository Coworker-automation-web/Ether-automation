import { type Role, roleAtLeast } from "./roles";

/**
 * Single source of truth for "who may do what". The API middleware, the Durable Object
 * and the UI all call can(). Nothing else may re-implement these checks.
 */

export type Rule =
  /** No sign-in required. */
  | { kind: "public" }
  /** Any signed-in user. */
  | { kind: "session" }
  /** Signed in, and the target is the caller's own record. */
  | { kind: "self" }
  /** Caller's role inside the org. `delegableTo` roles pass only with an explicit delegation flag. */
  | { kind: "org"; min: Role; delegableTo?: Role }
  /**
   * A workspace. Personal workspace: owner only. Organisation workspace: role-based
   * (`read` = any member incl. viewer, `edit` = member and above).
   */
  | { kind: "workspace"; access: "read" | "edit" };

export const PERMISSIONS = {
  // Authentication
  "auth.start": { kind: "public" },
  "auth.callback": { kind: "public" },
  "auth.logout": { kind: "session" },
  "me.read": { kind: "session" },
  "profile.update": { kind: "self" },

  // Organisations
  "org.create": { kind: "session" },
  "org.join": { kind: "session" },
  "members.list": { kind: "org", min: "viewer" },
  "member.remove": { kind: "org", min: "admin" },
  "role.change": { kind: "org", min: "admin" },
  "admin.transfer": { kind: "org", min: "admin" },
  "key.list": { kind: "org", min: "admin" },
  "key.mint": { kind: "org", min: "admin" },
  "key.revoke": { kind: "org", min: "admin" },
  "aikey.manage": { kind: "org", min: "admin", delegableTo: "executive" },

  // Organisation Public Workspace
  "publicWorkspace.read": { kind: "org", min: "viewer" },
  "publicWorkspace.upload": { kind: "org", min: "member" },

  // Personal workspaces
  "personal.list": { kind: "session" },
  "personal.create": { kind: "session" },

  // Live workspace, history and AI (personal: owner only; organisation: by role)
  "ws.connect": { kind: "workspace", access: "read" },
  "history.list": { kind: "workspace", access: "read" },
  "name-version": { kind: "workspace", access: "edit" },
  restore: { kind: "workspace", access: "edit" },
  "ai.run": { kind: "workspace", access: "edit" },
  "ai.summarize": { kind: "workspace", access: "edit" },
  "ai.usage": { kind: "session" },
} as const satisfies Record<string, Rule>;

export type Action = keyof typeof PERMISSIONS;
export const ACTIONS = Object.keys(PERMISSIONS) as Action[];

export interface AuthzContext {
  /** Defaults to `role !== null`. Pass true for a signed-in non-member on session-level actions. */
  signedIn?: boolean;
  /** `self` rules: the target record is the caller's own. */
  isSelf?: boolean;
  /** `workspace` rules. Omitted = "organisation": the server must always pass it explicitly. */
  workspaceScope?: "personal" | "organisation";
  /** Personal workspace: the caller owns it. */
  isOwner?: boolean;
  /** Executive holds an explicit AI-key delegation from the Admin. */
  aiKeyDelegated?: boolean;
}

/**
 * `role` is the caller's CURRENT role in the relevant org, or null when the caller is not an
 * active member (or there is no org, e.g. a personal workspace). Fails closed.
 */
export function can(role: Role | null, action: Action, ctx: AuthzContext = {}): boolean {
  const rule: Rule = PERMISSIONS[action];
  const signedIn = ctx.signedIn ?? role !== null;

  switch (rule.kind) {
    case "public":
      return true;
    case "session":
      return signedIn;
    case "self":
      return signedIn && ctx.isSelf === true;
    case "org": {
      if (!signedIn || role === null) return false;
      if (roleAtLeast(role, rule.min)) return true;
      return rule.delegableTo === role && ctx.aiKeyDelegated === true;
    }
    case "workspace": {
      if (!signedIn) return false;
      if (ctx.workspaceScope === "personal") return ctx.isOwner === true;
      if (role === null) return false;
      return roleAtLeast(role, rule.access === "read" ? "viewer" : "member");
    }
  }
}

// ---- Member-management invariants (the table says who may try; these say what is allowed) ----

/** Admin changes a non-admin member to a non-admin role. Admin is reachable only via transfer. */
export function canChangeRole(actor: Role, target: Role, next: Role): boolean {
  return can(actor, "role.change") && target !== "admin" && next !== "admin";
}

/** Admin removes any non-admin member. The sole Admin can never be removed (transfer first). */
export function canRemoveMember(actor: Role, target: Role): boolean {
  return can(actor, "member.remove") && target !== "admin";
}

/** Admin hands over to an existing Executive. */
export function canTransferAdmin(actor: Role, target: Role): boolean {
  return can(actor, "admin.transfer") && target === "executive";
}

// ---- Endpoint -> action map (the S3 route registry and tests build on this) ----

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRoute {
  readonly method: HttpMethod;
  readonly path: string;
  readonly action: Action;
}

export const API_ROUTES = [
  { method: "GET", path: "/api/auth/google", action: "auth.start" },
  { method: "GET", path: "/api/auth/google/callback", action: "auth.callback" },
  { method: "POST", path: "/api/auth/logout", action: "auth.logout" },
  { method: "GET", path: "/api/me", action: "me.read" },
  { method: "PATCH", path: "/api/profile", action: "profile.update" },

  { method: "POST", path: "/api/orgs", action: "org.create" },
  { method: "POST", path: "/api/orgs/join", action: "org.join" },
  { method: "GET", path: "/api/orgs/:orgId/members", action: "members.list" },
  { method: "DELETE", path: "/api/orgs/:orgId/members/:userId", action: "member.remove" },
  { method: "PATCH", path: "/api/orgs/:orgId/members/:userId/role", action: "role.change" },
  { method: "POST", path: "/api/orgs/:orgId/admin/transfer", action: "admin.transfer" },
  { method: "GET", path: "/api/orgs/:orgId/keys", action: "key.list" },
  { method: "POST", path: "/api/orgs/:orgId/keys", action: "key.mint" },
  { method: "DELETE", path: "/api/orgs/:orgId/keys/:keyId", action: "key.revoke" },

  { method: "GET", path: "/api/orgs/:orgId/public-workspace", action: "publicWorkspace.read" },
  { method: "POST", path: "/api/orgs/:orgId/public-workspace/uploads", action: "publicWorkspace.upload" },

  { method: "GET", path: "/api/personal/workspaces", action: "personal.list" },
  { method: "POST", path: "/api/personal/workspaces", action: "personal.create" },

  { method: "GET", path: "/api/ws/:workspaceId", action: "ws.connect" },
  { method: "GET", path: "/api/workspaces/:workspaceId/history", action: "history.list" },
  { method: "POST", path: "/api/workspaces/:workspaceId/history", action: "name-version" },
  { method: "POST", path: "/api/workspaces/:workspaceId/history/:snapshotId/restore", action: "restore" },

  { method: "POST", path: "/api/ai/generate", action: "ai.run" },
  { method: "POST", path: "/api/ai/summarize", action: "ai.summarize" },
  { method: "GET", path: "/api/ai/usage", action: "ai.usage" },

  { method: "GET", path: "/api/orgs/:orgId/ai-keys", action: "aikey.manage" },
  { method: "PUT", path: "/api/orgs/:orgId/ai-keys", action: "aikey.manage" },
  { method: "DELETE", path: "/api/orgs/:orgId/ai-keys", action: "aikey.manage" },
  { method: "POST", path: "/api/orgs/:orgId/ai-keys/test", action: "aikey.manage" },
] as const satisfies readonly ApiRoute[];
