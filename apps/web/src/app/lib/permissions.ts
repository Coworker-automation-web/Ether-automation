import { can as sharedCan, type Action, type AuthzContext, type Role } from "@ether/shared";

/**
 * The UI's one way to ask "may I?". It forwards to the shared permission table; the only thing
 * added here is the context a signed-in browser session always has, so call sites read
 * `can(role, "restore")`. Personal workspaces pass their own context (see authzContext in
 * features/workspace/access.ts). No rule lives in this file.
 */
export function can(role: Role | null, action: Action, ctx: AuthzContext = {}): boolean {
  return sharedCan(role, action, { signedIn: true, workspaceScope: "organisation", ...ctx });
}

export type { Action, AuthzContext, Role };
