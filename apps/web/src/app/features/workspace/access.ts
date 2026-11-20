import { can, type AuthzContext } from "@ether/shared";
import type { WorkspaceAccess } from "../../lib/contracts";

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
