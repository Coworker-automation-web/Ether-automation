import type { AuthzContext, MeResponse } from "@ether/shared";
import type { CurrentUser, WorkspaceAccess } from "../../lib/contracts";
import { can } from "../../lib/permissions";

/** The one place a WorkspaceAccess becomes a shared `can()` context. Nothing here re-implements a rule. */
export function authzContext(access: WorkspaceAccess): AuthzContext {
  return {
    signedIn: true,
    workspaceScope: access.scope,
    isOwner: access.isOwner,
    aiKeyDelegated: access.aiKeyDelegated,
  };
}

export interface Capabilities {
  readonly canConnect: boolean;
  readonly canListHistory: boolean;
  readonly canEdit: boolean;
  readonly canRestore: boolean;
  readonly canRunAi: boolean;
  readonly canSummarize: boolean;
  readonly canManageAiKey: boolean;
  readonly canUpload: boolean;
}

export function capabilitiesFor(access: WorkspaceAccess): Capabilities {
  const ctx = authzContext(access);
  const org = access.scope === "organisation";
  return {
    canConnect: can(access.role, "ws.connect", ctx),
    canListHistory: can(access.role, "history.list", ctx),
    // Editing the live document needs the same level as the other write actions.
    canEdit: can(access.role, "ai.run", ctx),
    canRestore: can(access.role, "restore", ctx),
    canRunAi: can(access.role, "ai.run", ctx),
    canSummarize: can(access.role, "ai.summarize", ctx),
    canManageAiKey: org && can(access.role, "aikey.manage", ctx),
    canUpload: org && can(access.role, "publicWorkspace.upload", ctx),
  };
}

export interface ResolvedWorkspace {
  readonly access: WorkspaceAccess;
  readonly user: CurrentUser;
}

/**
 * Turns GET /api/me plus the route's ids into what the workspace needs. Null when the user has
 * no membership in that organisation (the server still decides; this only avoids a doomed load).
 */
export function resolveWorkspace(me: MeResponse, orgId: string, workspaceId: string): ResolvedWorkspace | null {
  const membership = me.memberships.find((m) => m.orgId === orgId);
  if (!membership) return null;
  return {
    user: { id: me.user.id, name: me.user.name },
    access: {
      workspaceId,
      scope: "organisation",
      orgId,
      role: membership.role,
      isOwner: false,
      aiKeyDelegated: membership.aiKeyDelegated,
    },
  };
}
